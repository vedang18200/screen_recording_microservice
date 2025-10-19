# Resumable Direct-to-S3 Uploads with Uppy and Django Backend

## Overview
This documentation explains how to implement reliable, resumable video uploads from a React frontend to AWS S3 using Uppy (with the AwsS3Multipart plugin) and a Django backend. This method is robust for slow or unstable networks and allows users to resume uploads if interrupted.

---

## 1. How It Works

### Frontend (React + Uppy)
- Uppy is a JavaScript library for file uploads. It supports chunked, resumable uploads.
- The AwsS3Multipart plugin lets Uppy upload files directly to S3 using multipart upload.
- Uppy splits the file into small chunks (e.g., 2 MB each).
- Each chunk is uploaded directly to S3 using presigned URLs provided by your backend.
- If the upload is interrupted, Uppy can resume from the last successful chunk.

### Backend (Django)
- The backend provides endpoints for:
  - Creating a multipart upload session in S3.
  - Generating presigned URLs for each chunk.
  - Registering uploaded chunks.
  - Completing the upload and assembling the file in S3.
- The backend does not store the file; it only coordinates the upload.

---

## 2. Implementation Steps

### A. Frontend Setup

1. **Install Uppy and Plugins**
   ```bash
   npm install @uppy/core @uppy/react @uppy/dashboard @uppy/aws-s3-multipart
   ```

2. **Import Uppy in Your Component**
   ```javascript
   import Uppy from '@uppy/core';
   import { Dashboard } from '@uppy/react';
   import AwsS3Multipart from '@uppy/aws-s3-multipart';
   import '@uppy/core/style.css';
   import '@uppy/dashboard/style.css';
   ```

3. **Initialize Uppy**
   ```javascript
   const [uppy] = useState(() =>
     new Uppy({
       autoProceed: false,
       restrictions: { maxNumberOfFiles: 1 }
     })
       .use(AwsS3Multipart, {
         companionUrl: apiBaseUrl, // Your Django backend URL
         limit: 2, // Number of concurrent uploads
         chunkSize: 2 * 1024 * 1024 // 2 MB chunks
       })
   );
   ```

4. **Add Uppy Dashboard to JSX**
   ```jsx
   <Dashboard uppy={uppy} width={400} height={300} proudlyDisplayPoweredByUppy={false} />
   ```

5. **Remove Old Upload Logic**
   - Uppy now handles uploads, so you can remove any previous upload functions.

---

### B. Backend Setup (Django)

1. **Endpoints Required**
   - `/api/multipart/create/` (POST): Create a multipart upload session in S3.
   - `/api/multipart/<id>/presign/` (POST): Get a presigned URL for a chunk.
   - `/api/multipart/<id>/register-part/` (POST): Register a completed chunk.
   - `/api/multipart/<id>/complete/` (POST): Complete the upload and assemble the file in S3.

2. **How It Works**
   - The frontend requests a new upload session.
   - For each chunk, the frontend requests a presigned URL and uploads the chunk directly to S3.
   - After each chunk, the frontend registers the chunk with the backend.
   - When all chunks are uploaded, the frontend tells the backend to complete the upload.

3. **Sample Django View (for presigned URL)**
   ```python
   class GetPartPresignedUrlView(APIView):
       def post(self, request, upload_id):
           upload = UploadSession.objects.filter(id=upload_id).first()
           part_number = int(request.data.get('part_number'))
           s3 = _s3_client()
           url = s3.generate_presigned_url(
               'upload_part',
               Params={
                   'Bucket': settings.S3_BUCKET_NAME,
                   'Key': upload.s3_key,
                   'UploadId': upload.s3_upload_id,
                   'PartNumber': part_number
               },
               ExpiresIn=3600,
           )
           return Response({'presigned_url': url})
   ```

---

## 3. Why Use This Method?
- **Resumable:** Uploads can resume after network interruptions.
- **Efficient:** Files are uploaded directly to S3, not stored on your backend.
- **Reliable:** Small chunks are less likely to fail and can be retried.
- **User Experience:** Users can close/reopen the tab and continue uploading.

---

## 4. Common Problems & Solutions
- **Module Not Found Errors:**
  - Make sure all Uppy packages are installed in your project directory.
  - Use the correct style import paths: `@uppy/core/style.css` and `@uppy/dashboard/style.css`.
- **CORS Issues:**
  - Ensure your S3 bucket and backend allow CORS requests from your frontend.
- **Backend Endpoint Compatibility:**
  - Uppy expects specific request/response formats. Make sure your backend matches these.
- **Chunk Size:**
  - Set chunk size to 2 MB for better reliability on slow networks.

---

## 5. References
- [Uppy Documentation](https://uppy.io/docs/)
- [AWS S3 Multipart Upload](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html)
- [Django REST Framework](https://www.django-rest-framework.org/)

---

**If you need step-by-step code for your backend or frontend, let me know!**
