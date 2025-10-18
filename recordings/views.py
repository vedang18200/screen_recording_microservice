from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from .models import ScreenRecording, UploadSession, UploadPart
from .serializers import (
    ScreenRecordingSerializer,
    UploadSessionCreateSerializer,
    UploadPartSerializer,
    UploadSessionSerializer,
)

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
import uuid


def _s3_client():
    return boto3.client('s3', region_name=getattr(settings, 'S3_REGION_NAME', None))


class SimpleUploadView(APIView):
    """Keep backward compatibility: accept full multipart/form-data upload and save to ScreenRecording."""

    def post(self, request):
        serializer = ScreenRecordingSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            video_url = request.build_absolute_uri(serializer.data['video'])
            return Response({'video_url': video_url}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CreateUploadSessionView(APIView):
    """Creates a multipart upload session in S3 and a DB record."""

    def post(self, request):
        input_serializer = UploadSessionCreateSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        data = input_serializer.validated_data

        s3 = _s3_client()
        # generate a unique key
        key = f"recordings/{uuid.uuid4().hex}/{data['filename']}"

        try:
            resp = s3.create_multipart_upload(Bucket=settings.S3_BUCKET_NAME, Key=key, ContentType=data.get('content_type'))
        except ClientError as e:
            return Response({'detail': 'Failed to create multipart upload', 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            # In development return the traceback to help debugging
            import traceback
            tb = traceback.format_exc()
            if settings.DEBUG:
                return Response({'detail': 'Unexpected error creating multipart upload', 'error': str(e), 'traceback': tb}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            return Response({'detail': 'Unexpected error creating multipart upload'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        upload = UploadSession.objects.create(
            user_id=data.get('user_id'),
            filename=data['filename'],
            content_type=data.get('content_type', 'application/octet-stream'),
            size=data.get('size'),
            s3_key=key,
            s3_upload_id=resp.get('UploadId'),
            status='uploading',
        )

        out = UploadSessionSerializer(upload).data
        out['bucket'] = settings.S3_BUCKET_NAME
        out['s3_upload_id'] = upload.s3_upload_id
        return Response(out, status=status.HTTP_201_CREATED)


class GetPartPresignedUrlView(APIView):
    """Return a presigned URL for uploading a specific part number to S3."""

    def post(self, request, upload_id):
        upload = UploadSession.objects.filter(id=upload_id).first()
        if not upload:
            return Response({'detail': 'Upload session not found'}, status=status.HTTP_404_NOT_FOUND)

        part_number = int(request.data.get('part_number'))

        s3 = _s3_client()
        try:
            url = s3.generate_presigned_url(
                'upload_part',
                Params={'Bucket': settings.S3_BUCKET_NAME, 'Key': upload.s3_key, 'UploadId': upload.s3_upload_id, 'PartNumber': part_number},
                ExpiresIn=3600,
            )
        except ClientError as e:
            return Response({'detail': 'Failed to generate presigned url', 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({'presigned_url': url})


class RegisterPartView(APIView):
    """Register an uploaded part's ETag after successful PUT to the presigned URL."""

    def post(self, request, upload_id):
        upload = UploadSession.objects.filter(id=upload_id).first()
        if not upload:
            return Response({'detail': 'Upload session not found'}, status=status.HTTP_404_NOT_FOUND)

        part_serializer = UploadPartSerializer(data=request.data)
        part_serializer.is_valid(raise_exception=True)
        p = part_serializer.validated_data

        UploadPart.objects.update_or_create(upload=upload, part_number=p['part_number'], defaults={'etag': p['etag']})
        return Response({'status': 'ok'})


class CompleteUploadView(APIView):
    """Complete multipart upload by providing list of parts (partNumber + etag)."""

    def post(self, request, upload_id):
        upload = UploadSession.objects.filter(id=upload_id).first()
        if not upload:
            return Response({'detail': 'Upload session not found'}, status=status.HTTP_404_NOT_FOUND)

        parts = request.data.get('parts')
        if not parts:
            return Response({'detail': 'Parts list required'}, status=status.HTTP_400_BAD_REQUEST)

        # Build parts structure expected by S3
        s3_parts = [{'PartNumber': int(p['part_number']), 'ETag': p['etag']} for p in parts]

        s3 = _s3_client()
        try:
            resp = s3.complete_multipart_upload(Bucket=settings.S3_BUCKET_NAME, Key=upload.s3_key, UploadId=upload.s3_upload_id, MultipartUpload={'Parts': s3_parts})
        except ClientError as e:
            return Response({'detail': 'Failed to complete upload', 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        upload.status = 'completed'
        upload.save()

        # Optionally create ScreenRecording DB record linking to media URL (if desired)
        # screen = ScreenRecording.objects.create(user_id=upload.user_id or "", video=upload.s3_key)

        file_url = resp.get('Location') or f"https://{settings.S3_BUCKET_NAME}.s3.amazonaws.com/{upload.s3_key}"
        return Response({'file_url': file_url})


class UploadStatusView(APIView):
    def get(self, request, upload_id):
        upload = UploadSession.objects.filter(id=upload_id).first()
        if not upload:
            return Response({'detail': 'Upload session not found'}, status=status.HTTP_404_NOT_FOUND)

        ser = UploadSessionSerializer(upload).data
        return Response(ser)


class AbortUploadView(APIView):
    def post(self, request, upload_id):
        upload = UploadSession.objects.filter(id=upload_id).first()
        if not upload:
            return Response({'detail': 'Upload session not found'}, status=status.HTTP_404_NOT_FOUND)

        s3 = _s3_client()
        try:
            s3.abort_multipart_upload(Bucket=settings.S3_BUCKET_NAME, Key=upload.s3_key, UploadId=upload.s3_upload_id)
        except ClientError:
            # ignore errors on abort
            pass

        upload.status = 'aborted'
        upload.save()
        return Response({'status': 'aborted'})
