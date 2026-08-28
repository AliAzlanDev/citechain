suppressPackageStartupMessages({
  library(readxl)
  library(dplyr)
})

options(stringsAsFactors = FALSE, scipen = 999)

script_file <- sub("^--file=", "", grep("^--file=", commandArgs(trailingOnly = FALSE), value = TRUE)[1])
SCRIPT_DIR <- dirname(normalizePath(script_file, winslash = "/", mustWork = TRUE))
BOOK <- file.path(SCRIPT_DIR, "inputs", "CiteChain_Reviews_and_Studies.xlsx")
SEED_ROOT <- file.path(SCRIPT_DIR, "inputs", "seed_articles")
OUT <- file.path(SCRIPT_DIR, "outputs")
dir.create(OUT, recursive = TRUE, showWarnings = FALSE)

squish <- function(x) trimws(gsub("\\s+", " ", ifelse(is.na(x), "", as.character(x))))
standardize_doi <- function(x) {
  x <- tolower(squish(x))
  x <- sub("^(https?://)?(dx\\.)?doi\\.org/", "", x, perl = TRUE)
  x <- sub("^doi\\s*:\\s*", "", x, perl = TRUE)
  x[x %in% c("na", "n/a", "null", "none", "not available")] <- ""
  x
}
normalize_title <- function(x) {
  x <- iconv(squish(x), from = "", to = "ASCII//TRANSLIT", sub = "")
  gsub("[^a-z0-9]", "", tolower(x), perl = TRUE)
}
write_csv <- function(x, name) {
  write.csv(x, file.path(OUT, name), row.names = FALSE, na = "", fileEncoding = "UTF-8")
}

doi_corrections <- tibble::tribble(
  ~review, ~study_id, ~corrected_doi,
  "R01", "R01_S039", "10.1002/gps.2126",
  "R01", "R01_S102", "10.1016/S0140-6736(09)62042-0",
  "R02", "R02_S032", "10.1016/j.ekir.2020.02.830",
  "R04", "R04_S005", "10.1002/bjs.8781"
) %>% mutate(corrected_doi = standardize_doi(corrected_doi))

targets <- bind_rows(lapply(1:12, function(i) {
  review <- sprintf("R%02d", i)
  read_excel(BOOK, sheet = sprintf("R_%02d", i)) %>%
    filter(!is.na(Study_ID), nzchar(squish(Study_ID))) %>%
    transmute(
      review = review,
      study_id = squish(Study_ID),
      doi_archived = standardize_doi(DOI),
      year = suppressWarnings(as.integer(Year)),
      recorded_tertile = squish(Tertile)
    ) %>%
    left_join(doi_corrections, by = c("review", "study_id")) %>%
    mutate(doi = if_else(!is.na(corrected_doi), corrected_doi, doi_archived)) %>%
    select(-corrected_doi)
}))

tertile_records <- targets %>%
  group_by(review) %>%
  mutate(
    percentile_33 = quantile(year, 0.33, na.rm = TRUE, type = 7),
    percentile_67 = quantile(year, 0.67, na.rm = TRUE, type = 7),
    calculated_tertile = case_when(
      is.na(year) ~ "",
      year <= percentile_33 ~ "Early",
      year <= percentile_67 ~ "Middle",
      TRUE ~ "Recent"
    ),
    tertile_match = recorded_tertile == calculated_tertile
  ) %>%
  ungroup()

sampling_rows <- lapply(sprintf("R%02d", 1:12), function(review) {
  # Reproduce the historical seed draw from the archived DOI state. Current
  # manuscript denominators use the corrected `doi` field above.
  pool <- tertile_records %>% filter(.data$review == .env$review, nzchar(doi_archived))
  set.seed(20260410)
  reproduced <- pool %>%
    group_by(recorded_tertile) %>%
    group_split() %>%
    lapply(function(x) slice_sample(x, n = min(2L, nrow(x)))) %>%
    bind_rows()
  archived_ids <- read_excel(file.path(SEED_ROOT, review, "Seed_Articles.xlsx")) %>%
    filter(!is.na(Study_ID), nzchar(squish(Study_ID))) %>%
    pull(Study_ID) %>%
    squish() %>%
    unique()
  review_records <- tertile_records %>% filter(.data$review == .env$review)
  seed_records <- review_records %>% filter(study_id %in% archived_ids)
  tibble(
    review = review,
    included_reports = nrow(review_records),
    reports_with_doi = sum(nzchar(review_records$doi)),
    reports_without_doi = sum(!nzchar(review_records$doi)),
    percentile_33 = first(review_records$percentile_33),
    percentile_67 = first(review_records$percentile_67),
    tertile_mismatches = sum(!review_records$tertile_match),
    reproduced_seeds = nrow(reproduced),
    archived_seeds = length(archived_ids),
    doi_seeds = sum(nzchar(seed_records$doi)),
    non_doi_seeds = sum(!nzchar(seed_records$doi)),
    doi_non_seed_reports = sum(nzchar(review_records$doi)) - sum(nzchar(seed_records$doi)),
    non_doi_non_seed_reports = sum(!nzchar(review_records$doi)) - sum(!nzchar(seed_records$doi)),
    exact_seed_set_match = setequal(reproduced$study_id, archived_ids),
    early_seeds = sum(reproduced$recorded_tertile == "Early"),
    middle_seeds = sum(reproduced$recorded_tertile == "Middle"),
    recent_seeds = sum(reproduced$recorded_tertile == "Recent")
  )
})
sampling_audit <- bind_rows(sampling_rows)

supplementary_s1_counts <- sampling_audit %>%
  transmute(
    review_id = review,
    total_eligible_reports = included_reports,
    seed_reports = archived_seeds,
    primary_non_seed_reports = included_reports - archived_seeds,
    reports_with_doi = reports_with_doi,
    reports_without_doi = reports_without_doi,
    seed_reports_with_doi = doi_seeds,
    seed_reports_without_doi = non_doi_seeds,
    non_seed_reports_with_doi = doi_non_seed_reports,
    non_seed_reports_without_doi = non_doi_non_seed_reports
  )

screening <- read_excel(BOOK, sheet = "Review_Screening") %>%
  transmute(
    database = squish(Database),
    title_norm = normalize_title(Title),
    screen_status = squish(Screen_Status),
    exclusion_reason = squish(Exclusion_Reason)
  )
selected <- read_excel(BOOK, sheet = "Selected_Reviews") %>%
  transmute(title_norm = normalize_title(Title))
screening <- screening %>%
  left_join(selected %>% mutate(selected = TRUE), by = "title_norm") %>%
  mutate(selected = coalesce(selected, FALSE))
screening_summary <- screening %>%
  count(database, screen_status, selected, name = "n")
exclusion_summary <- screening %>%
  filter(screen_status == "Exclude") %>%
  mutate(exclusion_reason = if_else(nzchar(exclusion_reason), exclusion_reason, "Not recorded")) %>%
  count(exclusion_reason, name = "n") %>%
  arrange(desc(n), exclusion_reason)

checks <- tibble(
  check = c(
    "All 645 target reports reconstructed",
    "All recorded tertiles reproduce using PERCENTILE.INC/type 7 cut points",
    "All 12 archived six-seed sets reproduce with seed 20260410",
    "All selected reviews appear in the screening log",
    "Supplementary Table S1 counts reconcile"
  ),
  passed = c(
    nrow(targets) == 645L,
    all(sampling_audit$tertile_mismatches == 0L),
    nrow(sampling_audit) == 12L && all(sampling_audit$exact_seed_set_match) &&
      all(sampling_audit$reproduced_seeds == 6L),
    sum(screening$selected) == 12L,
    sum(supplementary_s1_counts$total_eligible_reports) == 645L &&
      sum(supplementary_s1_counts$seed_reports) == 72L &&
      sum(supplementary_s1_counts$primary_non_seed_reports) == 573L &&
      sum(supplementary_s1_counts$reports_with_doi) == 562L &&
      sum(supplementary_s1_counts$reports_without_doi) == 83L &&
      sum(supplementary_s1_counts$non_seed_reports_with_doi) == 490L &&
      sum(supplementary_s1_counts$non_seed_reports_without_doi) == 83L
  ),
  detail = c(
    as.character(nrow(targets)),
    paste0(sum(sampling_audit$tertile_mismatches), " mismatches"),
    paste0(sum(sampling_audit$exact_seed_set_match), "/12 exact sets"),
    paste0(sum(screening$selected), " selected reviews"),
    "645 total; 72 seeds; 573 non-seeds; 562 DOI; 83 non-DOI"
  )
)

write_csv(sampling_audit, "review_sampling_audit.csv")
write_csv(supplementary_s1_counts, "supplementary_table_s1_counts.csv")
write_csv(screening_summary, "review_screening_summary.csv")
write_csv(exclusion_summary, "screening_exclusion_reasons.csv")
write_csv(checks, "methods_validation_checks.csv")

report <- c(
  "# Methods and seed-selection audit", "",
  sprintf("- Target reports: %d.", nrow(targets)),
  sprintf("- Reports with DOI: %d; without DOI: %d.", sum(nzchar(targets$doi)), sum(!nzchar(targets$doi))),
  sprintf("- Tertile assignments reproduced: %d/%d.", sum(sampling_audit$tertile_mismatches == 0L), nrow(sampling_audit)),
  sprintf("- Archived seed sets reproduced exactly: %d/%d.", sum(sampling_audit$exact_seed_set_match), nrow(sampling_audit)),
  "- Tertiles use review-specific 33rd and 67th percentiles (R type 7, equivalent to PERCENTILE.INC).",
  "- Seed reproduction uses R seed 20260410 and samples two DOI-bearing reports from each recorded tertile.", "",
  paste0("Overall status: **", if (all(checks$passed)) "PASS" else "FAIL", "**")
)
writeLines(report, file.path(OUT, "METHODS_AUDIT.md"), useBytes = TRUE)
cat(paste(report, collapse = "\n"), "\n")
if (!all(checks$passed)) stop("Methods audit failed")
