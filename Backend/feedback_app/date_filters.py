from datetime import datetime, timedelta
from django.utils import timezone
from .models import Feedback_SubmissionLog

def get_allowed_ranges(user_role: str) -> list[str]:
    """Returns the allowed date range keys based on the user's role."""
    base_ranges = ['last_6_months', 'last_1_year', 'last_2_years', 'last_3_years', 'last_5_years', 'custom']
    if user_role == 'admin':
        return base_ranges + ['all_time']
    # hod gets base_ranges, which already excludes all_time
    return base_ranges

def get_date_range(range_key: str, custom_start=None, custom_end=None) -> tuple[datetime, datetime]:
    """
    Returns (start_date, end_date) based on the range key.
    If range_key is 'all_time', returns (None, None).
    """
    now = timezone.now()
    
    if range_key == 'all_time':
        return None, None
        
    if range_key == 'custom':
        # Expecting YYYY-MM-DD strings
        if not custom_start or not custom_end:
            raise ValueError("custom_start and custom_end are required for custom range")
        
        # Parse dates and make them timezone-aware
        start_date = timezone.make_aware(datetime.strptime(custom_start, '%Y-%m-%d'))
        # End date should be at the end of the day
        end_date = timezone.make_aware(datetime.strptime(custom_end, '%Y-%m-%d'))
        end_date = end_date.replace(hour=23, minute=59, second=59, microsecond=999999)
        return start_date, end_date

    # Standard ranges
    if range_key == 'last_6_months':
        # Roughly 180 days for 6 months
        start_date = now - timedelta(days=180)
    elif range_key == 'last_1_year':
        start_date = now - timedelta(days=365)
    elif range_key == 'last_2_years':
        start_date = now - timedelta(days=365 * 2)
    elif range_key == 'last_3_years':
        start_date = now - timedelta(days=365 * 3)
    elif range_key == 'last_5_years':
        start_date = now - timedelta(days=365 * 5)
    else:
        # Default fallback
        start_date = now - timedelta(days=180)
        
    return start_date, now

def validate_date_range(user, range_key: str, custom_start=None, custom_end=None):
    """
    Validates that the user is allowed to request the given range_key.
    Returns (start_date, end_date).
    Raises PermissionError if unauthorized.
    """
    user_role = getattr(user, 'role', 'hod')
    allowed = get_allowed_ranges(user_role)
    
    # Default to last 6 months if an invalid or missing range is provided
    if not range_key or range_key not in allowed:
        if range_key == 'all_time' and user_role != 'admin':
            raise PermissionError("Access to 'all_time' is restricted to admin users.")
        # Fallback to default
        range_key = 'last_6_months'
        
    return get_date_range(range_key, custom_start, custom_end)

def apply_feedback_date_filter(feedback_qs, start_date, end_date):
    """
    Filters a Feedback_Response queryset based on the SubmissionLog's Timestamp.
    If start_date and end_date are None, returns the original queryset.
    """
    if not start_date or not end_date:
        return feedback_qs
        
    # Find ResponseIDs that fall within the date range in Feedback_SubmissionLog
    valid_logs = Feedback_SubmissionLog.objects.filter(
        Timestamp__gte=start_date,
        Timestamp__lte=end_date
    )
    
    # Filter the feedback_qs to only include those ResponseIDs
    return feedback_qs.filter(ResponseID__in=valid_logs.values('ResponseID'))
