# Backend Upload Flow: Testing & Analysis (backend-upload branch)

## 1. Current Logic: Recording Upload to S3 (Backend Flow)

### Frontend
- User records a video in the browser.
- When the user clicks upload, the frontend sends the entire video file as a `multipart/form-data` POST request to `/api/upload/backend/`.

### Backend (Django)
- The `BackendUploadView` receives the request.
- It extracts the file from `request.FILES['file']`.
- It generates a unique S3 key (filename/path).
- It uses `boto3` to upload the file to your S3 bucket:
  ```python
  s3.upload_fileobj(file_obj, settings.S3_BUCKET_NAME, key, ExtraArgs={...})
  ```
- After upload, it creates a DB record and returns the S3 URL to the frontend.

## 2. Why is it taking so long?
- The entire file is uploaded from the browser to your Django server first.
- Then, the Django server uploads the file to S3.
- This means the file is transferred twice:
  1. Browser → Django server
  2. Django server → S3
- If your server is not on the same network as S3, or has limited bandwidth, this can be slow.
- Large files (hundreds of MBs or more) will take longer, especially if your server or your own upload speed is slow.
- The process is synchronous: the frontend waits for the backend to finish uploading to S3 before getting a response.

#### Example (from your test):
- The request to `/api/upload/backend/` took 3.5 minutes (201 Created), which means the backend was busy uploading the file to S3 during that time.

## 3. Problems with This Approach
- **Double Transfer:** The file is uploaded twice (browser→backend, backend→S3), doubling the time and bandwidth required.
- **User Waits:** The user must keep the tab open until both uploads finish, which can take several minutes for large files.
- **No Progress Feedback:** The user only sees progress for the browser→backend upload, not the backend→S3 upload.
- **Network Instability:** On slow or unstable networks (e.g., 3G), the upload is more likely to fail, and the user must restart from the beginning.
- **Resource Usage:** The backend server must handle large file uploads and may run out of memory or bandwidth under heavy load.

## 4. When is it Safe to Close the Tab?
- The user must keep the tab open until the file is fully sent to the backend.
- If the user closes the tab during the browser→backend upload, the upload will fail.
- If the user closes the tab after the backend has received the file, the backend will continue uploading to S3, but the user will not receive a success/failure message.

## 5. Recommendations
- For large files or slow networks, consider using direct-to-S3 multipart uploads or asynchronous backend processing (e.g., Celery) to improve reliability and user experience.

---

**Tested on branch:** `backend-upload`
**Date:** October 20, 2025
