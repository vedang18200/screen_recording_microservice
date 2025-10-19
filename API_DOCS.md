
# Screen Recording Microservice API Documentation

This microservice provides REST API endpoints for handling screen recording uploads using AWS S3 multipart upload. It is designed to be frontend-agnostic and S3-bucket-agnostic (configurable via environment variables).

---


## Environment Variables
Set the following variables in your `.env` file or Docker environment:

### Django settings
- `DJANGO_SECRET_KEY` - Your Django secret key (required)
- `DJANGO_DEBUG` - Set to `True` for development, `False` for production
- `DJANGO_ALLOWED_HOSTS` - Comma-separated list of allowed hosts (e.g. `*` for all)

### S3 settings
- `S3_BUCKET_NAME` - Name of your S3 bucket (required)
- `S3_REGION_NAME` - AWS region (default: `us-east-1`)
- `AWS_ACCESS_KEY_ID` - Your AWS access key (required)
- `AWS_SECRET_ACCESS_KEY` - Your AWS secret key (required)

### Database
- By default, uses SQLite for local development.
- To use Postgres or another DB, set the `DATABASE_URL` environment variable (see [dj-database-url](https://github.com/jacobian/dj-database-url)).
- Example for Postgres: `DATABASE_URL=postgres://user:password@db:5432/screenrec`
- If not set, defaults to SQLite.

---

---

## API Endpoints

### 1. `POST /api/upload/simple/`
- **Description:** Upload a complete file using multipart/form-data (legacy/simple upload).
- **Body:** `multipart/form-data` with file and metadata fields.
- **Response:** `{ "video_url": "<url>" }`


### 2. `POST /api/multipart/create/`
- **Description:** Create a new multipart upload session.
- **Body:**
  ```json
  {
    "filename": "example.mp4",
    "content_type": "video/mp4",
    "size": 123456,
    "user_id": "optional-user-id"
  }
  ```
- **Response:**
  ```json
  {
    "id": 1,
    "filename": "example.mp4",
    "content_type": "video/mp4",
    "size": 123456,
    "s3_key": "recordings/...",
    "s3_upload_id": "...",
    "bucket": "...",
    ...
  }
  ```


### 3. `POST /api/multipart/{upload_id}/presign/`
- **Description:** Get a presigned URL for uploading a part.
- **Body:** `{ "part_number": 1 }`
- **Response:** `{ "presigned_url": "..." }`


### 4. `POST /api/multipart/{upload_id}/register-part/`
- **Description:** Register a part's ETag after uploading to S3.
- **Body:** `{ "part_number": 1, "etag": "..." }`
- **Response:** `{ "status": "ok" }`


### 5. `POST /api/multipart/{upload_id}/complete/`
- **Description:** Complete the multipart upload.
- **Body:**
  ```json
  {
    "parts": [
      { "part_number": 1, "etag": "..." },
      { "part_number": 2, "etag": "..." }
    ]
  }
  ```
- **Response:** `{ "file_url": "..." }`


### 6. `GET /api/multipart/{upload_id}/status/`
- **Description:** Get the status of an upload session.
- **Response:** Upload session details.


### 7. `POST /api/multipart/{upload_id}/abort/`
- **Description:** Abort a multipart upload session.
- **Response:** `{ "status": "aborted" }`

---

## Usage
- Change S3 and Django settings via environment variables.
- Build and run with Docker or Docker Compose.
- Any frontend can use these endpoints for uploading large files to S3.

---

## Development & Deployment
- Build: `docker build -t screenrec_microservice .`
- Run: `docker run --env-file .env -p 8000:8000 screenrec_microservice`
- Or use: `docker-compose up --build`

---

## Notes
- Make sure your AWS credentials and S3 bucket permissions are correct.
- For production, set `DJANGO_DEBUG=False` and configure allowed hosts.
- Database defaults to SQLite; override with `DATABASE_URL` for Postgres or others.

---

## License
MIT or your chosen license.
