from datetime import date


def current_semester_start(today=None):
    """
    Semester boundaries: Jan 1 - Jun 30 and Jul 1 - Dec 31.
    Returns the start date of the semester containing `today`.
    """
    today = today or date.today()
    month = 1 if today.month <= 6 else 7
    return date(today.year, month, 1)
