from rest_framework import serializers
from .models import ScreenRecording, UploadSession

class ScreenRecordingSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScreenRecording
        fields = '__all__'


class UploadPartSerializer(serializers.Serializer):
    part_number = serializers.IntegerField()
    etag = serializers.CharField(max_length=512)


class UploadSessionCreateSerializer(serializers.Serializer):
    filename = serializers.CharField(max_length=255)
    content_type = serializers.CharField(max_length=100, required=False, default="application/octet-stream")
    size = serializers.IntegerField(required=False)
    user_id = serializers.CharField(max_length=100, required=False)


class UploadSessionSerializer(serializers.ModelSerializer):
    parts = serializers.SerializerMethodField()

    class Meta:
        model = UploadSession
        fields = ['id', 'user_id', 'filename', 'content_type', 'size', 's3_key', 'part_size', 'status', 'created_at', 'parts']

    def get_parts(self, obj):
        return [{'part_number': p.part_number, 'etag': p.etag} for p in obj.parts.all().order_by('part_number')]
