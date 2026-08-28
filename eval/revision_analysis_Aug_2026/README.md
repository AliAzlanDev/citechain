# CiteChain revision analysis (August 2026)

This directory contains the frozen inputs, analysis scripts, and generated outputs used for the revised CiteChain evaluation. The scripts resolve paths relative to their own location, so the directory can be copied and run independently of the rest of the repository.

## Requirements

- R 4.4.x
- `readxl` 1.4.5
- `dplyr` 1.1.4
- `tidyr` 1.3.1
- `stringdist` 0.9.12
- `digest` 0.6.36
- `ggplot2` 4.0.2
- `jsonlite` 1.8.8

These are the package versions used to generate the included outputs. Later compatible versions may also work. The validation environment is recorded in `outputs/R_SESSION_INFO.txt`.

Install the required packages if necessary:

```r
install.packages(c(
  "readxl", "dplyr", "tidyr", "stringdist",
  "digest", "ggplot2", "jsonlite"
))
```

## Reproducing the analysis

Run the scripts in numerical order from a terminal. No network access is required.

```text
Rscript 01_methods_and_seed_audit.R
Rscript 02_abstract_coverage.R
Rscript 03_revised_evaluation.R
Rscript 04_validate_results.R
```

For the fully packaged analysis, leave `CITECHAIN_ABSTRACT_METADATA_DIR` unset. Script 02 then reads the frozen metadata under `inputs/abstract_metadata`.

The final command should complete with `Overall status: PASS`. It regenerates `outputs/VALIDATION_REPORT.md`, `outputs/validation_checks.csv`, `outputs/output_manifest.csv`, and `outputs/R_SESSION_INFO.txt`.

## Directory contents

- `inputs/CiteChain_Reviews_and_Studies.xlsx`: evaluation reference workbook.
- `inputs/seed_articles`: archived seed selections for the 12 reviews.
- `inputs/tool_results`: archived forward- and backward-search results for the evaluated tools.
- `inputs/abstract_metadata`: frozen record-level metadata used for the abstract-coverage analysis.
- `inputs/semantic_scholar`: archived Semantic Scholar response data used for the reference-field assessment.
- `outputs`: generated tables, figures, record-level audit files, manifests, and validation reports.

`outputs/input_manifest.csv` and `outputs/abstract_input_manifest.csv` record the packaged inputs and their SHA-256 hashes. `outputs/output_manifest.csv` records generated analytical outputs; it intentionally excludes itself, the validation report, and the determinism-check file.

## Data-use notice

The analysis scripts are distributed under the repository's GNU Affero General Public License v3.0. The packaged bibliographic records may contain abstracts, copyright notices, and correspondence details supplied by third-party databases or publishers. Their inclusion for research reproducibility does not relicense that third-party content. Reuse remains subject to the applicable provider, publisher, and source-record terms, and correspondence details should not be used for unsolicited contact.
