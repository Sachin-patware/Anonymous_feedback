import secrets
from django.db import models
from django.utils import timezone
from datetime import datetime, timedelta
from django.core.validators import MinValueValidator


class AccessGrant(models.Model):
    """
    Persistent access grant model for student feedback authorization.
    Every generated link creates an independent AccessGrant record in the database.
    """
    id = models.BigAutoField(primary_key=True)
    grant_token = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        help_text="Cryptographically secure unique token identifying this grant"
    )
    session = models.CharField(
        max_length=50,
        help_text="Academic session, e.g. Jun-Dec 2026"
    )
    branch = models.CharField(
        max_length=50,
        help_text="Target branch, e.g. CSE(AIML)"
    )
    year = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1)],
        help_text="Target year (1-4)"
    )
    semester = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1)],
        help_text="Target semester (1-8)"
    )
    section = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1)],
        help_text="Target section (1-10)"
    )
    created_by = models.ForeignKey(
        "feedback_app.StaffUser",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_grants"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)
    max_responses = models.PositiveIntegerField(
        default=100,
        help_text="Maximum allowed feedback submissions for this grant"
    )
    response_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of responses submitted under this grant"
    )

    class Meta:
        db_table = "access_grants"
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.grant_token:
            self.grant_token = secrets.token_urlsafe(24)
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(minutes=15)
        super().save(*args, **kwargs)

    def is_expired(self) -> bool:
        """Check if the grant has passed its 15-minute expiration timestamp."""
        if not self.expires_at:
            return True
        # Compare in consistent UTC time
        current_time = datetime.now(timezone.utc).replace(tzinfo=None) if timezone.is_aware(self.expires_at) else datetime.utcnow()
        return current_time > self.expires_at

    def is_limit_reached(self) -> bool:
        """Check if the response limit has been reached."""
        return self.response_count >= self.max_responses

    def is_valid_for_submission(self) -> bool:
        """Check if the grant is active, not expired, and below max responses."""
        return self.is_active and not self.is_expired() and not self.is_limit_reached()

    def __str__(self):
        return f"Grant #{self.id} [{self.grant_token[:8]}] - {self.branch} Y{self.year}S{self.semester} Sec{self.section} ({self.session})"
