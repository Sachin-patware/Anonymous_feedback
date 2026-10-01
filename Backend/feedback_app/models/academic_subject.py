from django.db import models
from django.core.validators import MaxLengthValidator, MinValueValidator

class Academic_Subject(models.Model):
    SubjectCode = models.CharField(
        max_length=50,
        primary_key=True,
        validators=[MaxLengthValidator(50)]
    )
    SubjectName = models.CharField(max_length=255)
    Semester = models.PositiveSmallIntegerField(validators=[MinValueValidator(1)])
    branches = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "academic_subject"
        managed = False

    def __str__(self):
        return f"{self.SubjectCode}: {self.SubjectName}"
