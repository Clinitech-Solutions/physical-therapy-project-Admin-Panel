import { Component } from "@angular/core";
import { CoveredTreatments } from "../../../shared/components/covered-treatments/covered-treatments";

@Component({
  selector: "app-absence-coverage",
  imports: [CoveredTreatments],
  templateUrl: "./absence-coverage.html",
  styleUrl: "./absence-coverage.css",
})
export class AbsenceCoverage {}
