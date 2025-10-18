# Create your models here.
from django.db import models

class ScreenRecording(models.Model):
    user_id = models.CharField(max_length=100)
    video = models.FileField(upload_to='recordings/')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Recording by {self.user_id} at {self.created_at}"


class UploadSession(models.Model):
    STATUS_CHOICES = [
        ("created", "Created"),
        ("uploading", "Uploading"),
        ("completed", "Completed"),
        ("aborted", "Aborted"),
    ]

    user_id = models.CharField(max_length=100, blank=True, null=True)
    filename = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100, default="application/octet-stream")
    size = models.BigIntegerField(blank=True, null=True)
    s3_key = models.CharField(max_length=1024)
    s3_upload_id = models.CharField(max_length=512, blank=True, null=True)
    part_size = models.IntegerField(default=5 * 1024 * 1024)  # default 5 MiB
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="created")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"UploadSession {self.id} - {self.filename} ({self.status})"


class UploadPart(models.Model):
    upload = models.ForeignKey(UploadSession, related_name="parts", on_delete=models.CASCADE)
    part_number = models.IntegerField()
    etag = models.CharField(max_length=512, blank=True, null=True)
    size = models.BigIntegerField(blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("upload", "part_number")

    def __str__(self):
        return f"Part {self.part_number} for upload {self.upload_id}"
