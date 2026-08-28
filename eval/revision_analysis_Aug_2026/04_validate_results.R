
# Independent internal-consistency checks for the manuscript analysis.

suppressPackageStartupMessages({
  library(readxl)
  library(dplyr)
  library(tidyr)
  library(digest)
})

script_file <- sub("^--file=", "", grep("^--file=", commandArgs(trailingOnly = FALSE), value = TRUE)[1])
SCRIPT_DIR <- dirname(normalizePath(script_file, winslash = "/", mustWork = TRUE))
OUT <- file.path(SCRIPT_DIR, "outputs")
TARGET_BOOK <- file.path(SCRIPT_DIR, "inputs", "CiteChain_Reviews_and_Studies.xlsx")
SEED_ROOT <- file.path(SCRIPT_DIR, "inputs", "seed_articles")

TOOLS <- c(
  "CiteChain_Combined", "CiteChain_OpenAlex",
  "CiteChain_SemanticScholar", "Citationchaser", "PaperFetcher"
)
ESTIMANDS <- tibble::tribble(
  ~estimand, ~require_doi, ~exclude_seeds,
  "expanded_exclude_seeds", FALSE, TRUE,
  "expanded_include_seeds", FALSE, FALSE,
  "doi_exclude_seeds", TRUE, TRUE,
  "doi_include_seeds_replication", TRUE, FALSE
)

squish <- function(x) trimws(gsub("\\s+", " ", ifelse(is.na(x), "", as.character(x))))
standardize_doi <- function(x) {
  x <- tolower(squish(x))
  x <- sub("^https?://(?=10\\.)", "", x, perl = TRUE)
  x <- sub("^(https?://)?(dx\\.)?doi\\.org/", "", x, perl = TRUE)
  x <- sub("^doi\\s*:\\s*", "", x, perl = TRUE)
  x <- sub("\\?(urlappend|utm_source|utm_medium|utm_campaign)=.*$", "", x, perl = TRUE)
  x <- vapply(x, URLdecode, character(1), USE.NAMES = FALSE)
  x <- sub("\\.$", "", trimws(x), perl = TRUE)
  x[x %in% c("na", "n/a", "null", "none", "not available")] <- ""
  x
}

performance <- read.csv(file.path(OUT, "performance_by_review_and_estimand.csv"))
summary_results <- read.csv(file.path(OUT, "performance_summary.csv"))
matches <- read.csv(file.path(OUT, "target_matches.csv"))
pairwise <- read.csv(file.path(OUT, "pairwise_wilcoxon.csv"))
friedman_results <- read.csv(file.path(OUT, "friedman_tests.csv"))
fuzzy <- read.csv(file.path(OUT, "fuzzy_candidate_adjudication.csv"))
abstract_summary <- read.csv(file.path(OUT, "review_abstract_coverage_summary.csv"))
abstract_by_tool <- read.csv(
  file.path(OUT, "record_level_abstract_coverage_by_tool.csv"),
  na.strings = c("", "NA")
)
directions <- read.csv(file.path(OUT, "direction_by_review.csv"))
contributions <- read.csv(file.path(OUT, "direction_contribution_by_review.csv"))
s1_counts <- read.csv(file.path(OUT, "supplementary_table_s1_counts.csv"))
dual_api <- read.csv(file.path(OUT, "dual_api_overlap_by_review.csv"))
ss_elision <- read.csv(file.path(OUT, "semantic_scholar_reference_elision_summary.csv"))

corrections <- tibble::tribble(
  ~review, ~study_id, ~corrected_doi, ~decision,
  "R01", "R01_S039", "10.1002/gps.2126", "CORRECT_WRONG_DOI",
  "R01", "R01_S102", "10.1016/S0140-6736(09)62042-0", "CORRECT_WRONG_DOI",
  "R02", "R02_S032", "10.1016/j.ekir.2020.02.830", "CORRECT_WRONG_DOI",
  "R04", "R04_S005", "10.1002/bjs.8781", "CORRECT_COMMENTARY_DOI"
) %>%
  transmute(
    review, study_id, corrected_doi = standardize_doi(corrected_doi),
    has_correction = !is.na(decision) & nzchar(squish(decision))
  )

targets <- bind_rows(lapply(1:12, function(n) {
  review <- sprintf("R%02d", n)
  x <- read_excel(TARGET_BOOK, sheet = sprintf("R_%02d", n)) %>%
    filter(!is.na(Study_ID), nzchar(squish(Study_ID))) %>%
    transmute(review = review, study_id = squish(Study_ID), doi = standardize_doi(DOI)) %>%
    left_join(corrections, by = c("review", "study_id")) %>%
    mutate(doi = if_else(coalesce(has_correction, FALSE), corrected_doi, doi)) %>%
    select(review, study_id, doi)
  seed_ids <- read_excel(file.path(SEED_ROOT, review, "Seed_Articles.xlsx")) %>%
    filter(!is.na(Study_ID), nzchar(squish(Study_ID))) %>%
    pull(Study_ID) %>% squish() %>% unique()
  x$is_seed <- x$study_id %in% seed_ids
  x
}))

checks <- list()
add_check <- function(name, passed, detail) {
  checks[[length(checks) + 1L]] <<- tibble(
    check = name, passed = isTRUE(passed), detail = as.character(detail)
  )
}

add_check("target count", nrow(targets) == 645L, nrow(targets))
add_check("seed count", sum(targets$is_seed) == 72L, sum(targets$is_seed))
add_check(
  "Supplementary Table S1 counts",
  nrow(s1_counts) == 12L &&
    sum(s1_counts$total_eligible_reports) == 645L &&
    sum(s1_counts$seed_reports) == 72L &&
    sum(s1_counts$primary_non_seed_reports) == 573L &&
    sum(s1_counts$reports_with_doi) == 562L &&
    sum(s1_counts$reports_without_doi) == 83L &&
    sum(s1_counts$non_seed_reports_with_doi) == 490L &&
    sum(s1_counts$non_seed_reports_without_doi) == 83L,
  "12 reviews; totals 645/72/573; DOI 562/83; non-seed DOI 490/83"
)
figure_files <- file.path(OUT, c(
  "Figure3_primary_recall_distribution.png",
  "Figure3_primary_recall_distribution.tiff",
  "Figure4_primary_recall_screening_burden.png",
  "Figure4_primary_recall_screening_burden.tiff",
  "Figure5_directional_contribution.png",
  "Figure5_directional_contribution.tiff",
  "Supplementary_Figure_S2_direction_recall.png",
  "Supplementary_Figure_S2_direction_recall.tiff"
))
add_check(
  "primary manuscript figures",
  all(file.exists(figure_files)) && all(file.info(figure_files)$size > 10000),
  paste(basename(figure_files), collapse = "; ")
)
add_check(
  "dual-API overlap dimensions",
  nrow(dual_api) == 12L && all(dual_api$n_target > 0L),
  sprintf("%d review rows", nrow(dual_api))
)
add_check(
  "Semantic Scholar reference-elision input check",
  nrow(ss_elision) == 1L &&
    ss_elision$submitted_seed_responses == 72L &&
    ss_elision$reference_elision_notices == 61L,
  sprintf(
    "%d/%d submitted seed responses",
    ss_elision$reference_elision_notices,
    ss_elision$submitted_seed_responses
  )
)
add_check("performance dimensions", nrow(performance) == 240L,
          sprintf("%d rows", nrow(performance)))
add_check("complete reviews", length(unique(performance$review)) == 12L,
          length(unique(performance$review)))
add_check("complete tools", setequal(unique(performance$tool), TOOLS),
          paste(sort(unique(performance$tool)), collapse = "; "))
add_check("complete estimands", setequal(unique(performance$estimand), ESTIMANDS$estimand),
          paste(sort(unique(performance$estimand)), collapse = "; "))

expected_denominators <- c(
  expanded_exclude_seeds = 573L,
  expanded_include_seeds = 645L,
  doi_exclude_seeds = 490L,
  doi_include_seeds_replication = 562L
)
observed_denominators <- sapply(ESTIMANDS$estimand, function(e) {
  x <- performance[performance$estimand == e, ]
  sum(tapply(x$n_target, x$review, unique))
})
add_check(
  "estimand denominators",
  identical(as.integer(observed_denominators[names(expected_denominators)]),
            as.integer(expected_denominators)),
  paste(names(observed_denominators), observed_denominators, collapse = "; ")
)

recall_error <- max(abs(
  performance$recall_percent - 100 * performance$true_positives / performance$n_target
))
burden_error <- max(abs(
  performance$screening_burden -
    (performance$unique_citations - performance$true_positives)
))
nnr_keep <- !is.na(performance$nnr)
nnr_error <- max(abs(
  performance$nnr[nnr_keep] -
    performance$unique_citations[nnr_keep] / performance$true_positives[nnr_keep]
))
add_check("recall formula", recall_error < 1e-10, format(recall_error, scientific = TRUE))
add_check("screening burden formula", burden_error < 1e-10, format(burden_error, scientific = TRUE))
add_check("NNR formula", nnr_error < 1e-10, format(nnr_error, scientific = TRUE))
add_check("nonnegative burden", all(performance$screening_burden >= 0),
          min(performance$screening_burden))

# Independently reconstruct true positives from target-level matches.
reconstructed <- list()
ri <- 0L
for (review in unique(targets$review)) {
  review_targets <- targets[targets$review == review, ]
  for (tool in TOOLS) {
    ids <- unique(matches$study_id[matches$review == review & matches$tool == tool])
    for (e in seq_len(nrow(ESTIMANDS))) {
      rule <- ESTIMANDS[e, ]
      eligible <- review_targets[
        (!rule$require_doi | nzchar(review_targets$doi)) &
          (!rule$exclude_seeds | !review_targets$is_seed),
      ]
      ri <- ri + 1L
      reconstructed[[ri]] <- tibble(
        review = review, tool = tool, estimand = rule$estimand,
        n_target_check = nrow(eligible), tp_check = sum(eligible$study_id %in% ids)
      )
    }
  }
}
reconstructed <- bind_rows(reconstructed)
joined <- performance %>%
  left_join(reconstructed, by = c("review", "tool", "estimand"))
add_check("target-level denominator reconciliation",
          all(joined$n_target == joined$n_target_check),
          sprintf("maximum difference %d", max(abs(joined$n_target - joined$n_target_check))))
add_check("target-level true-positive reconciliation",
          all(joined$true_positives == joined$tp_check),
          sprintf("maximum difference %d", max(abs(joined$true_positives - joined$tp_check))))

direction_wide <- directions %>%
  select(review, tool, direction, true_positives) %>%
  pivot_wider(names_from = direction, values_from = true_positives) %>%
  left_join(contributions, by = c("review", "tool")) %>%
  left_join(
    performance %>%
      filter(estimand == "expanded_exclude_seeds") %>%
      select(review, tool, primary_tp = true_positives),
    by = c("review", "tool")
  )
component_total_error <- max(abs(
  direction_wide$n_target -
    (direction_wide$forward_only + direction_wide$backward_only +
       direction_wide$both + direction_wide$neither)
))
forward_error <- max(abs(
  direction_wide$Forward - (direction_wide$forward_only + direction_wide$both)
))
backward_error <- max(abs(
  direction_wide$Backward - (direction_wide$backward_only + direction_wide$both)
))
union_error <- max(abs(
  direction_wide$primary_tp -
    (direction_wide$forward_only + direction_wide$backward_only + direction_wide$both)
))
add_check("direction component total reconciliation", component_total_error == 0,
          sprintf("maximum difference %d", component_total_error))
add_check("forward contribution reconciliation", forward_error == 0,
          sprintf("maximum difference %d", forward_error))
add_check("backward contribution reconciliation", backward_error == 0,
          sprintf("maximum difference %d", backward_error))
add_check("direction union to primary reconciliation", union_error == 0,
          sprintf("maximum difference %d", union_error))

median_check <- performance %>%
  group_by(estimand, tool) %>%
  summarise(median_check = median(recall_percent), .groups = "drop") %>%
  left_join(summary_results[, c("estimand", "tool", "median_recall_percent")],
            by = c("estimand", "tool"))
median_error <- max(abs(median_check$median_check - median_check$median_recall_percent))
add_check("median reconciliation", median_error < 1e-10, format(median_error, scientific = TRUE))

friedman_check <- bind_rows(lapply(ESTIMANDS$estimand, function(e) {
  wide <- performance %>%
    filter(estimand == e) %>%
    select(review, tool, recall_percent) %>%
    pivot_wider(names_from = tool, values_from = recall_percent) %>%
    arrange(review)
  test <- friedman.test(as.matrix(wide[, TOOLS]))
  tibble(estimand = e, statistic_check = unname(test$statistic), p_check = test$p.value)
})) %>% left_join(friedman_results, by = "estimand")
friedman_stat_error <- max(abs(friedman_check$statistic_check - friedman_check$friedman_chi_square))
friedman_p_error <- max(abs(friedman_check$p_check - friedman_check$p_value))
add_check("Friedman statistic reconciliation", friedman_stat_error < 1e-10,
          format(friedman_stat_error, scientific = TRUE))
add_check("Friedman p-value reconciliation", friedman_p_error < 1e-10,
          format(friedman_p_error, scientific = TRUE))

adjustment_check <- pairwise %>%
  group_by(estimand) %>%
  mutate(
    holm_check = p.adjust(p_raw, "holm"),
    bonferroni_check = p.adjust(p_raw, "bonferroni")
  ) %>% ungroup()
holm_error <- max(abs(adjustment_check$p_holm - adjustment_check$holm_check))
bonf_error <- max(abs(adjustment_check$p_bonferroni - adjustment_check$bonferroni_check))
add_check("Holm adjustment reconciliation", holm_error < 1e-10, format(holm_error, scientific = TRUE))
add_check("Bonferroni adjustment reconciliation", bonf_error < 1e-10, format(bonf_error, scientific = TRUE))

replication <- summary_results[
  summary_results$estimand == "doi_include_seeds_replication",
  c("tool", "median_recall_percent")
]
expected_medians <- c(
  CiteChain_Combined = 33.7,
  CiteChain_OpenAlex = 33.7,
  CiteChain_SemanticScholar = 20.5,
  Citationchaser = 31.5,
  PaperFetcher = 28.2
)
observed_medians <- setNames(replication$median_recall_percent, replication$tool)
median_rounding_error <- max(abs(
  round(observed_medians[names(expected_medians)], 1) - expected_medians
))
add_check("corrected replication-estimand medians", median_rounding_error < 0.05,
          paste(names(expected_medians), round(observed_medians[names(expected_medians)], 1), collapse = "; "))

accepted <- fuzzy[fuzzy$decision == "ACCEPT", ]
add_check("manual adjudications", nrow(accepted) == 4L && length(unique(accepted$study_id)) == 1L,
          sprintf("%d tool-target acceptances for %d unique target", nrow(accepted), length(unique(accepted$study_id))))
add_check("manual matches represented", sum(matches$method == "manual_adjudicated_title") == 4L,
          sum(matches$method == "manual_adjudicated_title"))

tiered <- abstract_summary[abstract_summary$review == "TOTAL", ]
add_check("record-level abstract denominator", nrow(tiered) == 1L && tiered$original_unique_records == 7508L,
          tiered$original_unique_records)
add_check("record-level abstract numerator", nrow(tiered) == 1L && tiered$best_abstract_total == 4711L,
          tiered$best_abstract_total)
combined_coverage <- abstract_by_tool[abstract_by_tool$tool == "CiteChain_Combined", ]
add_check(
  "combined record-level abstract coverage",
  nrow(combined_coverage) == 1L && combined_coverage$denominator == 7508L &&
    combined_coverage$records_with_abstract == 4711L,
  sprintf("%d/%d", combined_coverage$records_with_abstract, combined_coverage$denominator)
)
citechain_coverage <- abstract_by_tool[
  abstract_by_tool$tool %in% c(
    "CiteChain_Combined", "CiteChain_OpenAlex", "CiteChain_SemanticScholar"
  ),
]
add_check(
  "same abstract-assessment method for all CiteChain modes",
  nrow(citechain_coverage) == 3L &&
    all(citechain_coverage$coverage_status == "calculable") &&
    all(grepl("record-level abstract assessment", citechain_coverage$evidence, fixed = TRUE)),
  paste(citechain_coverage$tool, citechain_coverage$records_with_abstract,
        citechain_coverage$denominator, sep = "=", collapse = "; ")
)
paperfetcher_coverage <- abstract_by_tool[abstract_by_tool$tool == "PaperFetcher", ]
add_check(
  "PaperFetcher abstract coverage not calculable",
  nrow(paperfetcher_coverage) == 1L &&
    paperfetcher_coverage$coverage_status == "not_calculable" &&
    is.na(paperfetcher_coverage$records_with_abstract) &&
    is.na(paperfetcher_coverage$abstract_coverage_percent),
  "DOI-only text output; numerator and percentage are NA"
)

checks <- bind_rows(checks)
write.csv(checks, file.path(OUT, "validation_checks.csv"), row.names = FALSE, na = "")

writeLines(capture.output(sessionInfo()), file.path(OUT, "R_SESSION_INFO.txt"), useBytes = TRUE)

analytic_files <- sort(list.files(
  OUT, pattern = "\\.(csv|md|txt|png|tiff)$", full.names = TRUE
))
analytic_files <- analytic_files[!basename(analytic_files) %in% c(
  "output_manifest.csv", "VALIDATION_REPORT.md", "determinism_check.csv"
)]
manifest <- tibble(
  file = basename(analytic_files),
  bytes = as.numeric(file.info(analytic_files)$size),
  sha256 = vapply(analytic_files, digest, character(1), algo = "sha256", file = TRUE)
)
write.csv(manifest, file.path(OUT, "output_manifest.csv"), row.names = FALSE, na = "")

status <- if (all(checks$passed)) "PASS" else "FAIL"
report <- c(
  "# Revised evaluation validation report", "",
  paste0("Overall status: **", status, "**"), "",
  "| Check | Status | Detail |", "|---|---:|---|",
  vapply(seq_len(nrow(checks)), function(i) sprintf(
    "| %s | %s | %s |", checks$check[i],
    if (checks$passed[i]) "PASS" else "FAIL",
    gsub("\\|", "/", checks$detail[i])
  ), character(1))
)
writeLines(report, file.path(OUT, "VALIDATION_REPORT.md"), useBytes = TRUE)
cat(paste(report, collapse = "\n"), "\n")
if (!all(checks$passed)) stop("One or more validation checks failed")
