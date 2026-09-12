from django.core.management.base import BaseCommand

from feedback_app.archival import current_semester_start
from feedback_app.models import Feedback_Response


class Command(BaseCommand):
    help = (
        "Marks Feedback_Response rows from before the current semester "
        "(Jan-Jun / Jul-Dec) as archived, so the analytics dashboard only "
        "ever reflects the current semester's data. Meant to run on Jan 1 "
        "and Jul 1 via a scheduled job."
    )

    def handle(self, *args, **options):
        cutoff = current_semester_start()
        updated = Feedback_Response.objects.filter(
            created_at__lt=cutoff, is_archived=False
        ).update(is_archived=True)
        self.stdout.write(
            self.style.SUCCESS(
                f"Archived {updated} feedback response(s) created before {cutoff}."
            )
        )
