from django.db import models
from django.core.validators import MinValueValidator

class Academic_Allocation(models.Model):
    AllocationID = models.AutoField(primary_key=True)
    TeacherID = models.ForeignKey(
        "feedback_app.Faculty_Teacher",
        db_column="TeacherID",
        on_delete=models.CASCADE,
    )
    SubjectCode = models.ForeignKey(
        "feedback_app.Academic_Subject",
        db_column="SubjectCode",
        on_delete=models.CASCADE,
    )
    TargetBranch = models.CharField(max_length=50)
    Target_Year = models.PositiveSmallIntegerField(validators=[MinValueValidator(1)])
    Target_Semester = models.PositiveSmallIntegerField(validators=[MinValueValidator(1)])
    Target_Section = models.PositiveSmallIntegerField(validators=[MinValueValidator(1)])
    AcademicSession = models.CharField(
        max_length=20,
        db_column="AcademicSession"
    )

    class Meta:
        db_table = "academic_allocation"
        managed = False

    def __str__(self):
        return f"Alloc {self.AllocationID}: {self.TeacherID} -> {self.SubjectCode}"
