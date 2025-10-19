from django.urls import path
from .views import (
    SimpleUploadView,
    CreateUploadSessionView,
    GetPartPresignedUrlView,
    RegisterPartView,
    CompleteUploadView,
    UploadStatusView,
    AbortUploadView,
    BackendUploadView,
)

urlpatterns = [
    # backward compatible simple upload
    path('upload/', SimpleUploadView.as_view(), name='upload-recording'),
    # backend upload endpoint
    path('upload/backend/', BackendUploadView.as_view(), name='backend-upload'),

    # multipart/session endpoints
    path('multipart/create/', CreateUploadSessionView.as_view(), name='create-upload-session'),
    path('multipart/<int:upload_id>/presign/', GetPartPresignedUrlView.as_view(), name='presign-part'),
    path('multipart/<int:upload_id>/register-part/', RegisterPartView.as_view(), name='register-part'),
    path('multipart/<int:upload_id>/complete/', CompleteUploadView.as_view(), name='complete-upload'),
    path('multipart/<int:upload_id>/status/', UploadStatusView.as_view(), name='upload-status'),
    path('multipart/<int:upload_id>/abort/', AbortUploadView.as_view(), name='abort-upload'),
]
