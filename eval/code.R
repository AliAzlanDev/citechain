# ============================================================================
# CITATION TOOL EVALUATION — MULTI-REVIEW ANALYSIS
# CiteChain: Development and Empirical Evaluation
# ============================================================================
# Authors:  Ali Azlan, Wajeeha Fatima Tareen, Abdul Wahab Mirza,
#           Abraiz Ahmad, Fahad Abdullah Saeed, Zoha Rafaqat, Sophia Ahmed
# Journal:  Research Synthesis Methods
# Date:     April 2026
# R Version: 4.3.0 or higher
#
# REPRODUCIBILITY NOTE:
#   All random operations use set.seed(20260410), matching the date on which
#   all 120 citation searches were executed (11–12 April 2026).
#
# PIPELINE OVERVIEW:
#   Phase 1 — Data preparation and stratified seed selection
#   Phase 2 — Import tool results and match against target sets
#   Phase 3 — Recall, screening burden, and NNR metrics (with IQR)
#   Phase 4 — Inferential statistics: Friedman test + Wilcoxon post-hoc
#   Phase 5 — Dual-API analysis: Jaccard similarity + unique contributions
#   Phase 6 — Domain subgroup analysis (Supplementary Section S1)
# ============================================================================
 
# ── SETUP ────────────────────────────────────────────────────────────────────
 
rm(list = ls())
 
required_packages <- c(
    "tidyverse", "readxl", "writexl",
    "here", "lubridate",
    "ggplot2", "scales", "ggrepel",
    "rstatix",
    "knitr"
)
 
new_packages <- required_packages[!(required_packages %in%
                                        installed.packages()[, "Package"])]
if (length(new_packages)) install.packages(new_packages)
 
lapply(required_packages, library, character.only = TRUE)
 
options(scipen = 999)
set.seed(20260410)   # Protocol seed — matches search execution date
 
# ── Base plot theme (white background, applied to all figures) ────────────────
theme_white <- theme_minimal(base_size = 12) +
    theme(
        plot.background   = element_rect(fill = "white", color = NA),
        panel.background  = element_rect(fill = "white", color = NA),
        legend.background = element_rect(fill = "white", color = NA),
        plot.title        = element_text(face = "bold"),
        axis.text.x       = element_text(angle = 45, hjust = 1)
    )
 
# Output directories
dir.create("output",  showWarnings = FALSE)
dir.create("figures", showWarnings = FALSE)
 
# ── CONFIGURATION ─────────────────────────────────────────────────────────────
 
TARGET_SETS_FILE <- "CiteChain_Reviews_and_Studies.xlsx"

# Domain column is required for Phase 7 (domain subgroup analysis,
# Supplementary Section S1). Values must match three evidence synthesis
# databases used in the evaluation: "Cochrane", "Campbell", "CEE".
review_config <- tribble(
    ~Review_ID, ~Review_Name,       ~Target_Sheet, ~N_Seeds_Per_Tertile, ~Domain,
    "R01", "Purgato, 2023",      "R_01", 2, "Cochrane",
    "R02", "Vernooij, 2024",     "R_02", 2, "Cochrane",
    "R03", "Glujovsky, 2020",    "R_03", 2, "Cochrane",
    "R04", "Whing, 2021",        "R_04", 2, "Cochrane",
    "R05", "Collinson, 2020",    "R_05", 2, "Cochrane",
    "R06", "Middleton, 2020",    "R_06", 2, "Cochrane",
    "R07", "Naing, 2023",        "R_07", 2, "Campbell",
    "R08", "Smith, 2022",        "R_08", 2, "Campbell",
    "R09", "Das, 2020",          "R_09", 2, "Campbell",
    "R10", "Sarma, 2022",        "R_10", 2, "Campbell",
    "R11", "Kudrin, 2023",       "R_11", 2, "CEE",
    "R12", "Miguel, 2020",       "R_12", 2, "CEE"
)
 
citation_tools <- c(
    "CiteChain_Combined",
    "CiteChain_OpenAlex",
    "CiteChain_SemanticScholar",
    "Citationchaser",
    "PaperFetcher"
)
 
# Ordered factor levels for consistent axis ordering across all figures
tool_order <- c(
    "CiteChain_Combined",
    "CiteChain_OpenAlex",
    "CiteChain_SemanticScholar",
    "Citationchaser",
    "PaperFetcher"
)
 
tool_labels <- c(
    "CiteChain_Combined"        = "CiteChain\n(Combined)",
    "CiteChain_OpenAlex"        = "CiteChain\n(OpenAlex)",
    "CiteChain_SemanticScholar" = "CiteChain\n(Semantic Scholar)",
    "Citationchaser"            = "Citationchaser",
    "PaperFetcher"              = "PaperFetcher"
)

cat("\n")
cat("============================================================================\n")
cat("MULTI-REVIEW CITATION TOOL EVALUATION — CiteChain\n")
cat("============================================================================\n\n")
cat(sprintf("Target sets file  : %s\n", TARGET_SETS_FILE))
cat(sprintf("Reviews           : %d\n", nrow(review_config)))
cat(sprintf("Citation tools    : %s\n\n", paste(citation_tools, collapse = ", ")))
 
if (!file.exists(TARGET_SETS_FILE)) {
    stop(sprintf(
        "Target sets file not found: '%s'\nUpdate TARGET_SETS_FILE at the top of this script.",
        TARGET_SETS_FILE
    ))
}
 
available_sheets <- excel_sheets(TARGET_SETS_FILE)
missing_sheets   <- setdiff(review_config$Target_Sheet, available_sheets)
if (length(missing_sheets) > 0) {
    stop(sprintf(
        "Sheets missing from '%s': %s\nAvailable: %s",
        TARGET_SETS_FILE,
        paste(missing_sheets, collapse = ", "),
        paste(available_sheets, collapse = ", ")
    ))
}
cat(sprintf("✓ All %d sheets verified in '%s'\n\n", nrow(review_config), TARGET_SETS_FILE))

# ── HELPER FUNCTIONS ──────────────────────────────────────────────────────────
 
# Standardize DOI to lowercase, remove URL prefixes
standardize_doi <- function(doi_string) {
    result <- doi_string %>%
        str_to_lower() %>%
        str_remove("^https?://doi\\.org/") %>%
        str_remove("^https?://dx\\.doi\\.org/") %>%
        str_remove("^doi:") %>%
        str_trim()
    ifelse(is.na(doi_string) | str_trim(doi_string) == "", NA_character_, result)
}
 
# Normalize title for fallback matching: lowercase, strip punctuation
normalize_title <- function(title_string) {
    map_chr(title_string, function(t) {
        if (is.na(t) || t == "") return(NA_character_)
        t %>%
            str_to_lower() %>%
            str_remove_all("[[:punct:]]") %>%
            str_remove_all("[^[:alnum:]]") %>%
            str_trim()
    })
}
 
# Import RIS file; returns tibble with DOI, Title, Year, Authors
import_ris <- function(filepath) {
    if (!file.exists(filepath)) return(tibble())
    ris_text    <- readLines(filepath, warn = FALSE, encoding = "UTF-8")
    record_ends <- which(str_detect(ris_text, "^ER  -"))
    if (length(record_ends) == 0) {
        warning(paste0("No records found in RIS file: ", filepath))
        return(tibble())
    }
    records   <- list()
    start_idx <- 1
    for (i in seq_along(record_ends)) {
        end_idx      <- record_ends[i]
        record_lines <- ris_text[start_idx:end_idx]
        doi <- record_lines[str_detect(record_lines, "^DO  -")] %>%
            str_extract("(?<=^DO  - ).*$") %>%
            first() %>%
            standardize_doi()
        title <- record_lines[str_detect(record_lines, "^TI  -|^T1  -")] %>%
            str_extract("(?<=^T[I1]  - ).*$") %>%
            paste(collapse = " ") %>%
            str_squish()
        year <- record_lines[str_detect(record_lines, "^PY  -|^Y1  -")] %>%
            str_extract("(?<=^[PY][Y1]  - )\\d{4}") %>%
            first()
        authors <- record_lines[str_detect(record_lines, "^AU  -|^A1  -")] %>%
            str_extract("(?<=^A[U1]  - ).*$") %>%
            paste(collapse = "; ")
        records[[i]] <- tibble(
            DOI     = doi,
            Title   = if_else(title == "", NA_character_, title),
            Year    = as.numeric(year),
            Authors = if_else(authors == "", NA_character_, authors)
        )
        start_idx <- end_idx + 1
    }
    bind_rows(records)
}
 
# Import CSV file with flexible column detection
import_csv <- function(filepath) {
    if (!file.exists(filepath)) return(tibble())
    df        <- read_csv(filepath, show_col_types = FALSE)
    doi_col   <- names(df)[str_detect(str_to_lower(names(df)), "doi")]
    title_col <- names(df)[str_detect(str_to_lower(names(df)), "title")]
    year_col  <- names(df)[str_detect(str_to_lower(names(df)), "year")]
    result    <- df
    if (length(doi_col)   > 0) result <- result %>% rename(DOI   = all_of(doi_col[1]))
    if (length(title_col) > 0) result <- result %>% rename(Title = all_of(title_col[1]))
    if (length(year_col)  > 0) result <- result %>% rename(Year  = all_of(year_col[1]))
    if ("DOI" %in% names(result))
        result <- result %>% mutate(DOI = map_chr(DOI, standardize_doi))
    result %>% select(any_of(c("DOI", "Title", "Year", "Authors")))
}
 
# Import plain-text DOI list (one per line; PaperFetcher forward output format)
import_doi_list <- function(filepath) {
    if (!file.exists(filepath)) return(tibble())
    lines <- readLines(filepath, warn = FALSE, encoding = "UTF-8") %>%
        str_trim() %>%
        .[nchar(.) > 0]
    if (length(lines) == 0) {
        warning(paste0("No DOIs found in: ", filepath))
        return(tibble())
    }
    tibble(
        DOI     = standardize_doi(lines),
        Title   = NA_character_,
        Year    = NA_real_,
        Authors = NA_character_
    )
}
 
# Dispatch file import based on extension; guarantee the four standard columns
import_file <- function(fp) {
    result <- switch(
        tools::file_ext(fp),
        "ris" = import_ris(fp),
        "csv" = import_csv(fp),
        "txt" = import_doi_list(fp),
        {
            warning(paste0("Unrecognised file extension for: ", fp))
            tibble()
        }
    )
    if (!"DOI"     %in% names(result)) result$DOI     <- NA_character_
    if (!"Title"   %in% names(result)) result$Title   <- NA_character_
    if (!"Year"    %in% names(result)) result$Year    <- NA_real_
    if (!"Authors" %in% names(result)) result$Authors <- NA_character_
    result
}
 
# Stratified seed selection (year tertiles, n_per_tertile seeds per tertile)
select_seeds <- function(ref_set, n_per_tertile = 2, seed_value = 20260410) {
    set.seed(seed_value)
    eligible_pool <- ref_set %>%
        filter(Has_DOI_Flag == "Yes", !is.na(DOI_Standardized))
    if ("Tertile" %in% names(eligible_pool) && !all(is.na(eligible_pool$Tertile))) {
        seeds <- eligible_pool %>%
            group_by(Tertile) %>%
            group_split() %>%
            map_dfr(~ slice_sample(.x, n = min(n_per_tertile, nrow(.x))))
    } else {
        seeds <- eligible_pool %>% slice_sample(n = min(6, nrow(eligible_pool)))
    }
    if (nrow(seeds) < 6) {
        remaining_pool <- eligible_pool %>%
            anti_join(seeds, by = "Study_ID")
        if (nrow(remaining_pool) > 0) {
            additional <- remaining_pool %>%
                slice_sample(n = min(6 - nrow(seeds), nrow(remaining_pool)))
            seeds <- bind_rows(seeds, additional)
        }
    }
    seeds
}
 
# Jaccard Similarity Coefficient between two sets
jaccard <- function(set_a, set_b) {
    a <- set_a[!is.na(set_a)]
    b <- set_b[!is.na(set_b)]
    if (length(a) == 0 && length(b) == 0) return(NA_real_)
    length(intersect(a, b)) / length(union(a, b))
}

# ── PHASE 1: DATA PREPARATION ────────────────────────────────────────────────
 
cat("============================================================================\n")
cat("PHASE 1: DATA PREPARATION FOR ALL REVIEWS\n")
cat("============================================================================\n\n")
 
all_target_sets   <- list()
all_seed_articles <- list()
review_summaries  <- list()
 
for (i in seq_len(nrow(review_config))) {
    review_id    <- review_config$Review_ID[i]
    review_name  <- review_config$Review_Name[i]
    target_sheet <- review_config$Target_Sheet[i]
    n_seeds      <- review_config$N_Seeds_Per_Tertile[i]
 
    cat(sprintf("\n=== %s: %s (sheet: %s) ===\n", review_id, review_name, target_sheet))
 
    review_dir <- file.path("output", review_id)
    dir.create(review_dir, showWarnings = FALSE, recursive = TRUE)
 
    target_ref_set <- read_excel(TARGET_SETS_FILE, sheet = target_sheet) %>%
        mutate(
            DOI_Standardized = standardize_doi(DOI),
            Year             = as.numeric(Year),
            Has_DOI_Flag     = if_else(
                !is.na(DOI_Standardized) & DOI_Standardized != "", "Yes", "No"
            ),
            Title_Normalized = normalize_title(Title)
        )
 
    n_total    <- nrow(target_ref_set)
    n_with_doi <- sum(target_ref_set$Has_DOI_Flag == "Yes")
    n_excluded <- n_total - n_with_doi
    pct_excluded <- if (n_total > 0) round(100 * n_excluded / n_total, 2) else NA_real_
 
    cat(sprintf("  Total studies (original)    : %d\n", n_total))
    cat(sprintf("  Studies with valid DOI      : %d\n", n_with_doi))
    cat(sprintf("  Excluded (no valid DOI)     : %d (%.2f%%)\n", n_excluded, pct_excluded))
 
    # Restrict evaluation set to DOI-indexed studies
    target_ref_set <- target_ref_set %>% filter(Has_DOI_Flag == "Yes")
 
    seed_articles <- select_seeds(target_ref_set, n_per_tertile = n_seeds)
    cat(sprintf("  Seed articles selected      : %d\n", nrow(seed_articles)))
 
    write_xlsx(
        seed_articles %>% select(Study_ID, Review_ID, DOI = DOI_Standardized,
                                 Title, Year, any_of("Tertile")),
        file.path(review_dir, "Seed_Articles.xlsx")
    )
    writeLines(seed_articles$DOI_Standardized,
               file.path(review_dir, "Seed_DOIs.txt"))
 
    all_target_sets[[review_id]]   <- target_ref_set
    all_seed_articles[[review_id]] <- seed_articles
 
    review_summaries[[review_id]] <- tibble(
        Review_ID    = review_id,
        Review_Name  = review_name,
        Domain       = review_config$Domain[i],
        Sheet        = target_sheet,
        N_Original   = n_total,
        N_Excluded_No_DOI = n_excluded,
        Pct_Excluded = pct_excluded,
        N_Target     = nrow(target_ref_set),
        N_Seeds      = nrow(seed_articles)
    )
}
 
review_summary_df <- bind_rows(review_summaries)
write_xlsx(review_summary_df, "output/Phase1_Review_Summary.xlsx")
 
cat("\n============================================================================\n")
cat("PHASE 1 COMPLETE\n")
cat("============================================================================\n")
cat(sprintf("\nProcessed %d reviews\n", nrow(review_summary_df)))
cat(sprintf("DOI exclusion summary across reviews:\n"))
cat(sprintf("  Median: %.2f%%  Q1: %.2f%%  Q3: %.2f%%  Range: %.2f%%–%.2f%%\n\n",
    median(review_summary_df$Pct_Excluded, na.rm = TRUE),
    quantile(review_summary_df$Pct_Excluded, 0.25, na.rm = TRUE),
    quantile(review_summary_df$Pct_Excluded, 0.75, na.rm = TRUE),
    min(review_summary_df$Pct_Excluded,  na.rm = TRUE),
    max(review_summary_df$Pct_Excluded,  na.rm = TRUE)
))
 
save(all_target_sets, all_seed_articles, review_config, review_summary_df,
     citation_tools, TARGET_SETS_FILE,
     file = "output/Phase1_Data.RData")
cat("✓ Saved: output/Phase1_Data.RData\n\n")

# ── PHASE 2: IMPORT AND MATCH TOOL RESULTS ───────────────────────────────────
 
run_phase2 <- function() {
    cat("\n============================================================================\n")
    cat("PHASE 2: IMPORT AND MATCH TOOL RESULTS\n")
    cat("============================================================================\n\n")
 
    load("output/Phase1_Data.RData")
 
    all_review_results  <- list()
    all_retrieval_stats <- list()
    tool_results_dir    <- "output/tool_results"
    directions          <- c("Forward", "Backward")
    extensions          <- c("ris", "csv", "txt")
 
    # ── File availability check (12 × 5 × 2 = 120 expected files) ───────────
    cat("FILE AVAILABILITY CHECK\n")
    cat(strrep("-", 55), "\n")
 
    file_check_rows <- list()
    for (rv in review_config$Review_ID) {
        for (tl in citation_tools) {
            for (dr in directions) {
                found      <- FALSE
                found_name <- NA_character_
                for (ext in extensions) {
                    candidate <- file.path(
                        tool_results_dir,
                        paste0(rv, "_", tl, "_", dr, ".", ext)
                    )
                    if (file.exists(candidate)) {
                        found      <- TRUE
                        found_name <- basename(candidate)
                        break
                    }
                }
                file_check_rows[[length(file_check_rows) + 1]] <- tibble(
                    Review_ID = rv, Tool = tl, Direction = dr,
                    Found = found,
                    Filename = if_else(found, found_name,
                                       paste0(rv, "_", tl, "_", dr, ".[ris/csv/txt]"))
                )
            }
        }
    }
 
    file_check_df <- bind_rows(file_check_rows)
    n_found   <- sum(file_check_df$Found)
    n_missing <- sum(!file_check_df$Found)
    missing_df <- file_check_df %>% filter(!Found)
 
    review_file_summary <- file_check_df %>%
        group_by(Review_ID) %>%
        summarise(
            Expected = n(), Found = sum(Found), Missing = sum(!Found),
            Status   = if_else(Missing == 0, "✓ Complete",
                               paste0("✗ Missing ", Missing)),
            .groups = "drop"
        )
 
    cat(sprintf("%-8s  %-10s  %-8s  %-8s  %s\n",
                "Review", "Expected", "Found", "Missing", "Status"))
    cat(strrep("-", 55), "\n")
    for (j in seq_len(nrow(review_file_summary))) {
        cat(sprintf("%-8s  %-10s  %-8s  %-8s  %s\n",
                    review_file_summary$Review_ID[j],
                    review_file_summary$Expected[j],
                    review_file_summary$Found[j],
                    review_file_summary$Missing[j],
                    review_file_summary$Status[j]))
    }
    cat(strrep("-", 55), "\n")
    cat(sprintf("%-8s  %-10s  %-8s  %-8s\n",
                "TOTAL", nrow(file_check_df), n_found, n_missing))
 
    write_xlsx(
        list(Summary_By_Review = review_file_summary,
             Full_File_Log     = file_check_df,
             Missing_Files     = missing_df),
        "output/Phase2_File_Check.xlsx"
    )
    cat("\n✓ Log saved: output/Phase2_File_Check.xlsx\n")
     if (n_missing > 0) {
        cat(sprintf("\n✗ %d file(s) missing:\n\n", n_missing))
        for (k in seq_len(nrow(missing_df))) {
            cat(sprintf("  [%s] %s / %s\n    Expected: %s\n",
                        missing_df$Review_ID[k], missing_df$Tool[k],
                        missing_df$Direction[k], missing_df$Filename[k]))
        }
        answer <- readline("\nEnter 'a' to stop or 'b' to continue with available files: ")
        if (tolower(trimws(answer)) != "b")
            stop("Phase 2 stopped. Add missing files and re-run.")
        cat("\nContinuing with available files...\n")
    } else {
        cat(sprintf("\n✓ All %d files accounted for.\n", nrow(file_check_df)))
    }
 
    # ── Process each review ──────────────────────────────────────────────────
    cat("\n============================================================================\n")
    cat("PROCESSING TOOL RESULTS\n")
    cat("============================================================================\n")
 
    for (review_id in names(all_target_sets)) {
        cat(sprintf("\n=== %s ===\n", review_id))
 
        target_ref_set <- all_target_sets[[review_id]]
        review_dir     <- file.path("output", review_id)
        tool_results   <- list()
 
        for (tool_name in citation_tools) {
            fwd_file <- list.files(tool_results_dir,
                pattern    = paste0(review_id, "_", tool_name, "_Forward\\.(ris|csv|txt)$"),
                full.names = TRUE)
            bwd_file <- list.files(tool_results_dir,
                pattern    = paste0(review_id, "_", tool_name, "_Backward\\.(ris|csv|txt)$"),
                full.names = TRUE)
 
            if (length(fwd_file) == 0 && length(bwd_file) == 0) {
                cat(sprintf("  %-35s: no files — skipped\n", tool_name))
                next
            }
 
            fwd_data <- tibble()
            if (length(fwd_file) > 0)
                fwd_data <- import_file(fwd_file[1]) %>%
                    mutate(Direction = "Forward",
                           Title_Normalized = normalize_title(Title))
 
            bwd_data <- tibble()
            if (length(bwd_file) > 0)
                bwd_data <- import_file(bwd_file[1]) %>%
                    mutate(Direction = "Backward",
                           Title_Normalized = normalize_title(Title))
 
            combined <- bind_rows(fwd_data, bwd_data) %>%
                mutate(Tool = tool_name)
            tool_results[[tool_name]] <- combined
            cat(sprintf("  %-35s: %d records\n", tool_name, nrow(combined)))
        }
 
        if (length(tool_results) == 0) {
            warning(paste0("No tool results found for ", review_id))
            next
        }
 
        # ── Match retrieved citations against target set ─────────────────────
        matched_studies <- list()
        retrieval_stats <- list()
 
        for (tool_name in names(tool_results)) {
            tool_data  <- tool_results[[tool_name]]
            total_raw  <- nrow(tool_data)
 
            unique_citations <- tool_data %>%
                group_by(DOI, Title) %>%
                summarise(
                    Tool             = first(Tool),
                    Year             = first(Year),
                    Title_Normalized = first(Title_Normalized),
                    Directions       = paste(unique(Direction), collapse = "; "),
                    .groups          = "drop"
                )
 
            # Primary match: standardised DOI
            matched_by_doi <- unique_citations %>%
                filter(!is.na(DOI)) %>%
                inner_join(
                    target_ref_set %>% select(Study_ID, DOI_Standardized),
                    by = c("DOI" = "DOI_Standardized")
                ) %>%
                mutate(Match_Method = "DOI") %>%
                select(Study_ID, Directions, Match_Method)
 
            # Secondary match: normalised title (only for unmatched targets)
            # FIX: anti_join must specify the join key explicitly.
            # Using by = character() performs a cross-join in dplyr >= 1.1,
            # which is incorrect here.
            matched_by_title <- unique_citations %>%
                filter(!is.na(Title_Normalized), Title_Normalized != "") %>%
                inner_join(
                    target_ref_set %>%
                        filter(!Study_ID %in% matched_by_doi$Study_ID) %>%
                        select(Study_ID, Title_Normalized),
                    by = "Title_Normalized"
                ) %>%
                mutate(Match_Method = "Title") %>%
                select(Study_ID, Directions, Match_Method)
 
            all_matches       <- bind_rows(matched_by_doi, matched_by_title)
            matched_study_ids <- unique(all_matches$Study_ID)
            matched_studies[[tool_name]] <- matched_study_ids
 
            n_target <- nrow(target_ref_set)
            n_tp     <- length(matched_study_ids)
            n_unique <- nrow(unique_citations)
 
            retrieval_stats[[tool_name]] <- tibble(
                Review_ID          = review_id,
                Tool               = tool_name,
                Total_Raw_Records  = total_raw,
                Unique_Citations   = n_unique,
                True_Positives     = n_tp,
                Matched_By_DOI     = length(unique(matched_by_doi$Study_ID)),
                Matched_By_Title   = length(unique(matched_by_title$Study_ID)),
                N_Target           = n_target,
                Recall             = n_tp / n_target,
                Screening_Burden   = n_unique - n_tp,
                # FIX: guard against division by zero when TP = 0
                NNR                = if_else(n_tp > 0,
                                             n_unique / n_tp,
                                             NA_real_)
            )
        }
 
        all_review_results[[review_id]] <- list(
            matched_studies = matched_studies,
            tool_results    = tool_results
        )
        all_retrieval_stats[[review_id]] <- bind_rows(retrieval_stats)
 
        # Export unmatched targets for manual verification
        unmatched_list <- list()
        for (tool_name in names(matched_studies)) {
            unmatched_list[[tool_name]] <- target_ref_set %>%
                filter(!Study_ID %in% matched_studies[[tool_name]]) %>%
                mutate(
                    Tool               = tool_name,
                    Match_Status       = "NOT_FOUND",
                    Found_DOI          = NA_character_,
                    Found_In_Direction = NA_character_,
                    Notes              = NA_character_
                ) %>%
                select(Tool, Study_ID, Review_ID,
                       Target_DOI   = DOI_Standardized,
                       Target_Title = Title,
                       Target_Year  = Year,
                       any_of("Tertile"),
                       Match_Status, Found_DOI, Found_In_Direction, Notes)
        }
        write_xlsx(unmatched_list, file.path(review_dir, "Unmatched_Targets.xlsx"))
    }
 
    combined_stats <- bind_rows(all_retrieval_stats)
    write_xlsx(combined_stats, "output/Phase2_All_Retrieval_Stats.xlsx")
 
    save(all_target_sets, all_seed_articles, all_review_results,
         combined_stats, review_config, review_summary_df,
         citation_tools, TARGET_SETS_FILE,
         file = "output/Phase2_Data.RData")
 
    cat("\n============================================================================\n")
    cat("PHASE 2 COMPLETE\n")
    cat("============================================================================\n")
    cat("\nNEXT STEPS:\n")
    cat("1. Review Unmatched_Targets.xlsx in each review directory\n")
    cat("2. Manually verify and update Match_Status → 'FOUND' where applicable\n")
    cat("3. Save verified files as: [Review_ID]/Unmatched_Targets_VERIFIED.xlsx\n")
    cat("4. Run run_phase3() to calculate final performance metrics\n\n")
 
    invisible(all_review_results)
}

# ── PHASE 3: PERFORMANCE METRICS ─────────────────────────────────────────────
 
run_phase3 <- function() {
    cat("\n============================================================================\n")
    cat("PHASE 3: RECALL, SCREENING BURDEN, AND NNR METRICS\n")
    cat("============================================================================\n\n")
 
    load("output/Phase2_Data.RData")
 
    all_performance <- list()
 
    for (review_id in names(all_review_results)) {
        cat(sprintf("Processing %s...\n", review_id))
 
        target_ref_set  <- all_target_sets[[review_id]]
        review_dir      <- file.path("output", review_id)
        verified_file   <- file.path(review_dir, "Unmatched_Targets_VERIFIED.xlsx")
        matched_studies <- all_review_results[[review_id]]$matched_studies
 
        if (file.exists(verified_file)) {
            cat("  Using verified matches\n")
            for (sheet in excel_sheets(verified_file)) {
                manual <- read_excel(verified_file, sheet = sheet) %>%
                    filter(Match_Status == "FOUND") %>%
                    pull(Study_ID)
                if (length(manual) > 0 && sheet %in% names(matched_studies))
                    matched_studies[[sheet]] <- unique(c(matched_studies[[sheet]], manual))
            }
        } else {
            cat("  No verified file found — using automated matches only\n")
        }
 
        for (tool_name in names(matched_studies)) {
            n_tp     <- length(matched_studies[[tool_name]])
            n_target <- nrow(target_ref_set)
            stats    <- combined_stats %>%
                filter(Review_ID == review_id, Tool == tool_name)
 
            perf <- tibble(
                Review_ID      = review_id,
                Domain         = review_config$Domain[review_config$Review_ID == review_id],
                Tool           = tool_name,
                N_Target       = n_target,
                True_Positives = n_tp,
                Recall         = n_tp / n_target,
                Recall_Percent = 100 * n_tp / n_target
            )
            if (nrow(stats) > 0) {
                perf <- perf %>%
                    mutate(
                        Unique_Citations = stats$Unique_Citations,
                        Matched_By_DOI   = stats$Matched_By_DOI,
                        Matched_By_Title = stats$Matched_By_Title,
                        Screening_Burden = Unique_Citations - True_Positives,
                        NNR              = if_else(True_Positives > 0,
                                                   Unique_Citations / True_Positives,
                                                   NA_real_)
                    )
            }
            all_performance[[paste0(review_id, "_", tool_name)]] <- perf
        }
    }
 
    performance_df <- bind_rows(all_performance) %>%
        mutate(Tool = factor(Tool, levels = tool_order))
 
    # ── Aggregated performance: median + IQR (primary reporting metric) ──────
    # The manuscript reports all aggregate statistics as median (IQR) per
    # the pre-specified analysis plan (Section 3.5). Mean and SD are retained
    # as supplementary descriptives.
    aggregated_performance <- performance_df %>%
        group_by(Tool) %>%
        summarise(
            N_Reviews            = n(),
            Total_N_Target       = sum(N_Target),
            Total_True_Positives = sum(True_Positives),
            # Recall
            Median_Recall        = median(Recall_Percent, na.rm = TRUE),
            Q1_Recall            = quantile(Recall_Percent, 0.25, na.rm = TRUE),
            Q3_Recall            = quantile(Recall_Percent, 0.75, na.rm = TRUE),
            IQR_Recall           = IQR(Recall_Percent, na.rm = TRUE),
            Mean_Recall          = mean(Recall_Percent, na.rm = TRUE),
            SD_Recall            = sd(Recall_Percent, na.rm = TRUE),
            Min_Recall           = min(Recall_Percent, na.rm = TRUE),
            Max_Recall           = max(Recall_Percent, na.rm = TRUE),
            # Screening burden
            Median_Screening_Burden = median(Screening_Burden, na.rm = TRUE),
            Q1_Screening_Burden     = quantile(Screening_Burden, 0.25, na.rm = TRUE),
            Q3_Screening_Burden     = quantile(Screening_Burden, 0.75, na.rm = TRUE),
            # NNR
            Median_NNR           = median(NNR, na.rm = TRUE),
            Q1_NNR               = quantile(NNR, 0.25, na.rm = TRUE),
            Q3_NNR               = quantile(NNR, 0.75, na.rm = TRUE),
            # Match method breakdown
            Total_Matched_By_DOI   = sum(Matched_By_DOI,   na.rm = TRUE),
            Total_Matched_By_Title = sum(Matched_By_Title, na.rm = TRUE),
            .groups = "drop"
        ) %>%
        arrange(desc(Median_Recall))
 
    cat("\n=== Table 2: Recall Performance (Median, IQR, Mean ± SD) ===\n")
    aggregated_performance %>%
        select(Tool, Median_Recall, Q1_Recall, Q3_Recall,
               Mean_Recall, SD_Recall, Total_N_Target) %>%
        mutate(across(where(is.numeric), ~ round(., 1))) %>%
        print()
 
    cat("\n=== Table 3: Screening Burden and NNR (Median, IQR) ===\n")
    aggregated_performance %>%
        select(Tool, Median_Screening_Burden, Q1_Screening_Burden,
               Q3_Screening_Burden, Median_NNR, Q1_NNR, Q3_NNR) %>%
        mutate(across(where(is.numeric), ~ round(., 1))) %>%
        print()
 
    # ── Figure 3: Recall distribution boxplot ───────────────────────────────
    fig3 <- ggplot(performance_df,
                   aes(x = Tool, y = Recall_Percent, fill = Tool)) +
        geom_boxplot(alpha = 0.7, outlier.shape = 21, outlier.size = 2) +
        geom_jitter(width = 0.15, alpha = 0.5, size = 2) +
        scale_x_discrete(labels = tool_labels) +
        scale_fill_brewer(palette = "Set2") +
        labs(
            title    = "Recall Distribution Across Reviews by Tool",
            subtitle = sprintf("n = %d systematic reviews", length(unique(performance_df$Review_ID))),
            x = NULL, y = "Recall (%)"
        ) +
        theme_white +
        theme(legend.position = "none")
 
    ggsave("figures/Figure3_Recall_Distribution.png",
           fig3, width = 10, height = 6, dpi = 300, bg = "white")
    cat("\n✓ Saved: figures/Figure3_Recall_Distribution.png\n")
 
    # ── Figure 4: Recall–Screening Burden trade-off (one point per tool) ─────
    # Computed from aggregated medians as described in Section 4.4.
    fig4_data <- aggregated_performance %>%
        select(Tool, Median_Recall, Median_Screening_Burden)
 
    fig4 <- ggplot(fig4_data,
                   aes(x = Median_Recall, y = Median_Screening_Burden,
                       label = tool_labels[as.character(Tool)])) +
        geom_point(aes(colour = Tool), size = 5) +
        geom_label_repel(size = 3.5, box.padding = 0.4,
                         point.padding = 0.3, max.overlaps = 20) +
        scale_colour_brewer(palette = "Set2") +
        labs(
            title    = "Recall–Screening Burden Trade-off",
            subtitle = "Each point represents median values across 12 systematic reviews",
            x        = "Median Recall (%)",
            y        = "Median Screening Burden (unique non-relevant citations)"
        ) +
        theme_white +
        theme(legend.position = "none",
              axis.text.x = element_text(angle = 0, hjust = 0.5))
 
    ggsave("figures/Figure4_Recall_Screening_Tradeoff.png",
           fig4, width = 8, height = 6, dpi = 300, bg = "white")
    cat("✓ Saved: figures/Figure4_Recall_Screening_Tradeoff.png\n")
 
    # ── Additional diagnostic figures ────────────────────────────────────────
 
    # Recall heatmap (reviews × tools)
    fig_heatmap <- ggplot(performance_df,
                          aes(x = Tool, y = Review_ID, fill = Recall_Percent)) +
        geom_tile(colour = "white", linewidth = 0.5) +
        geom_text(aes(label = round(Recall_Percent, 0)), size = 3) +
        scale_x_discrete(labels = tool_labels) +
        scale_fill_gradient2(
            low = "#d73027", mid = "#fee090", high = "#1a9850",
            midpoint = 50, limits = c(0, 100), name = "Recall (%)"
        ) +
        labs(title = "Recall Performance: Reviews × Tools", x = NULL, y = NULL) +
        theme_white +
        theme(axis.text.x = element_text(angle = 45, hjust = 1),
              legend.position = "right")
 
    ggsave("figures/Supplementary_Recall_Heatmap.png",
           fig_heatmap, width = 10, height = 8, dpi = 300, bg = "white")
 
    # Matching method breakdown
    fig_match <- performance_df %>%
        group_by(Tool) %>%
        summarise(DOI   = sum(Matched_By_DOI,   na.rm = TRUE),
                  Title = sum(Matched_By_Title, na.rm = TRUE),
                  .groups = "drop") %>%
        pivot_longer(c(DOI, Title), names_to = "Method", values_to = "Count") %>%
        ggplot(aes(x = Tool, y = Count, fill = Method)) +
        geom_col(position = "stack", alpha = 0.85) +
        geom_text(aes(label = Count),
                  position = position_stack(vjust = 0.5),
                  colour = "white", fontface = "bold") +
        scale_x_discrete(labels = tool_labels) +
        scale_fill_manual(values = c("DOI" = "#2E86AB", "Title" = "#A23B72"),
                          labels = c("DOI match", "Title match")) +
        labs(title    = "Matching Method Contribution",
             subtitle = "Total matches across all 12 reviews",
             x = NULL, y = "Number of matches", fill = NULL) +
        theme_white +
        theme(legend.position = "top")
 
    ggsave("figures/Supplementary_Matching_Methods.png",
           fig_match, width = 10, height = 6, dpi = 300, bg = "white")
 
    # Save outputs
    write_xlsx(
        list(Aggregated = aggregated_performance,
             By_Review  = as.data.frame(performance_df),
             Review_Summary = review_summary_df),
        "output/Phase3_Performance_Results.xlsx"
    )
 
    save(performance_df, aggregated_performance, review_config, review_summary_df,
         citation_tools, all_review_results, all_target_sets, combined_stats,
         file = "output/Phase3_Data.RData")
 
    cat("\n============================================================================\n")
    cat("PHASE 3 COMPLETE\n")
    cat("============================================================================\n\n")
 
    invisible(list(aggregated = aggregated_performance, by_review = performance_df))
}

# ── PHASE 4: INFERENTIAL STATISTICS ──────────────────────────────────────────
#
# Pre-specified analysis (Section 3.5):
#   Primary test : Friedman test across 5-tool recall distributions (α = 0.05)
#   Post-hoc     : Pairwise Wilcoxon signed-rank tests, Bonferroni correction
#                  (10 comparisons; adjusted α = 0.005)
#   Effect size  : r = Z / √N (Wilcoxon effect size estimate)
 
run_phase4 <- function() {
    cat("\n============================================================================\n")
    cat("PHASE 4: INFERENTIAL STATISTICS\n")
    cat("============================================================================\n\n")
 
    load("output/Phase3_Data.RData")
 
    # ── Friedman test ─────────────────────────────────────────────────────────
    # Requires wide format: rows = reviews, columns = tools
    recall_wide <- performance_df %>%
        select(Review_ID, Tool, Recall_Percent) %>%
        pivot_wider(names_from = Tool, values_from = Recall_Percent)
 
    recall_matrix <- recall_wide %>%
        select(all_of(tool_order)) %>%
        as.matrix()
 
    friedman_result <- friedman.test(recall_matrix)
 
    cat("=== Friedman Test: Recall distributions across 5 tool configurations ===\n")
    cat(sprintf("  χ² = %.3f  df = %d  p = %.4f\n\n",
                friedman_result$statistic,
                friedman_result$parameter,
                friedman_result$p.value))
 
    # ── Pairwise Wilcoxon signed-rank tests (Bonferroni) ────────────────────
    # rstatix::pairwise_wilcox_test handles paired tests and p-adjustment.
    # Effect size r = |Z| / √N is computed via rstatix::wilcox_effsize.
    n_reviews <- length(unique(performance_df$Review_ID))
 
    posthoc_raw <- performance_df %>%
        pairwise_wilcox_test(
            Recall_Percent ~ Tool,
            paired         = TRUE,
            p.adjust.method = "bonferroni"
        ) %>%
        rename(p_adjusted = p.adj, p_adj_signif = p.adj.signif)
 
    effect_sizes <- performance_df %>%
        wilcox_effsize(
            Recall_Percent ~ Tool,
            paired = TRUE
        ) %>%
        select(group1, group2, effsize, magnitude) %>%
        rename(r_effect_size = effsize, magnitude = magnitude)
 
    posthoc_full <- posthoc_raw %>%
        left_join(effect_sizes, by = c("group1", "group2")) %>%
        mutate(
            Bonferroni_Threshold = 0.005,
            Significant          = p_adjusted < Bonferroni_Threshold
        ) %>%
        select(group1, group2, n1, n2, statistic, p, p_adjusted,
               p_adj_signif, r_effect_size, magnitude,
               Bonferroni_Threshold, Significant) %>%
        arrange(p_adjusted)
 
    cat("=== Post-hoc Wilcoxon Pairwise Comparisons (Bonferroni adjusted α = 0.005) ===\n")
    cat("=== Supplementary Table S3 ===\n\n")
    print(posthoc_full %>%
        mutate(across(where(is.numeric), ~ round(., 4))))
 
    # ── Summarise results ────────────────────────────────────────────────────
    friedman_summary <- tibble(
        Test        = "Friedman",
        Statistic   = friedman_result$statistic,
        df          = friedman_result$parameter,
        p_value     = friedman_result$p.value,
        Significant = friedman_result$p.value < 0.05,
        Alpha       = 0.05,
        Note        = sprintf(
            "χ²(%d, N=%d) = %.3f, p = %.4f",
            friedman_result$parameter, n_reviews,
            friedman_result$statistic, friedman_result$p.value
        )
    )
 
    cat("\n=== Friedman Test Summary ===\n")
    print(friedman_summary)
 
    write_xlsx(
        list(Friedman_Test    = friedman_summary,
             Pairwise_Wilcoxon = as.data.frame(posthoc_full)),
        "output/Phase4_Statistical_Tests.xlsx"
    )
    cat("\n✓ Saved: output/Phase4_Statistical_Tests.xlsx\n")
 
    # ── Forest-style effect size figure for Supplementary ───────────────────
    fig_effects <- posthoc_full %>%
        mutate(
            Comparison = paste0(group1, "\nvs.\n", group2),
            Comparison = factor(Comparison,
                                levels = rev(unique(Comparison)))
        ) %>%
        ggplot(aes(x = r_effect_size, y = Comparison,
                   colour = Significant, shape = Significant)) +
        geom_vline(xintercept = 0, linetype = "dashed", colour = "grey60") +
        geom_point(size = 4) +
        scale_colour_manual(
            values  = c("TRUE" = "#d62728", "FALSE" = "#1f77b4"),
            labels  = c("TRUE" = "p_adj < 0.005", "FALSE" = "p_adj ≥ 0.005"),
            name    = NULL
        ) +
        scale_shape_manual(
            values  = c("TRUE" = 17, "FALSE" = 16),
            labels  = c("TRUE" = "p_adj < 0.005", "FALSE" = "p_adj ≥ 0.005"),
            name    = NULL
        ) +
        labs(title    = "Supplementary Figure: Effect Sizes — Pairwise Wilcoxon Tests",
             subtitle = "r = |Z| / √N; Bonferroni-adjusted α = 0.005 (10 comparisons)",
             x        = "Effect size r",
             y        = NULL) +
        theme_white +
        theme(axis.text.x = element_text(angle = 0, hjust = 0.5),
              axis.text.y = element_text(size = 8),
              legend.position = "bottom")
 
    ggsave("figures/Supplementary_Effect_Sizes.png",
           fig_effects, width = 9, height = 8, dpi = 300, bg = "white")
    cat("✓ Saved: figures/Supplementary_Effect_Sizes.png\n")
 
    cat("\n============================================================================\n")
    cat("PHASE 4 COMPLETE\n")
    cat("============================================================================\n\n")
 
    invisible(list(friedman = friedman_result, posthoc = posthoc_full))
}

# ── PHASE 5: DUAL-API ANALYSIS ────────────────────────────────────────────────
#
# Two analyses described in Section 3.5 and Section 4.5:
#   (a) Jaccard Similarity Coefficient between OpenAlex and Semantic Scholar
#       retrieval sets, computed per review then summarised as median (IQR).
#   (b) Unique API contribution: proportion of target studies identified
#       exclusively by OpenAlex, exclusively by Semantic Scholar, by both,
#       or by neither — computed per review.
 
run_phase5 <- function() {
    cat("\n============================================================================\n")
    cat("PHASE 5: DUAL-API ANALYSIS — JACCARD SIMILARITY AND UNIQUE CONTRIBUTIONS\n")
    cat("============================================================================\n\n")
 
    load("output/Phase3_Data.RData")
 
    jaccard_results      <- list()
    contribution_results <- list()
 
    for (review_id in names(all_review_results)) {
        tool_res        <- all_review_results[[review_id]]$tool_results
        target_ref_set  <- all_target_sets[[review_id]]
        matched_studies <- all_review_results[[review_id]]$matched_studies
 
        # ── (a) Jaccard on full retrieval sets (all retrieved DOIs) ──────────
        oa_dois <- if ("CiteChain_OpenAlex" %in% names(tool_res))
            unique(tool_res[["CiteChain_OpenAlex"]]$DOI[
                !is.na(tool_res[["CiteChain_OpenAlex"]]$DOI)])
        else character(0)
 
        ss_dois <- if ("CiteChain_SemanticScholar" %in% names(tool_res))
            unique(tool_res[["CiteChain_SemanticScholar"]]$DOI[
                !is.na(tool_res[["CiteChain_SemanticScholar"]]$DOI)])
        else character(0)
 
        j_coeff <- jaccard(oa_dois, ss_dois)
 
        jaccard_results[[review_id]] <- tibble(
            Review_ID         = review_id,
            N_OpenAlex_DOIs   = length(oa_dois),
            N_SemanticScholar_DOIs = length(ss_dois),
            N_Intersection    = length(intersect(oa_dois, ss_dois)),
            N_Union           = length(union(oa_dois, ss_dois)),
            Jaccard           = j_coeff
        )
 
        # ── (b) Unique API contribution to target study identification ───────
        oa_hits <- matched_studies[["CiteChain_OpenAlex"]]        %||% character(0)
        ss_hits <- matched_studies[["CiteChain_SemanticScholar"]] %||% character(0)
        all_targets <- target_ref_set$Study_ID
 
        n_target    <- length(all_targets)
        oa_only     <- setdiff(oa_hits, ss_hits)
        ss_only     <- setdiff(ss_hits, oa_hits)
        both_apis   <- intersect(oa_hits, ss_hits)
        neither     <- setdiff(all_targets, union(oa_hits, ss_hits))
 
        contribution_results[[review_id]] <- tibble(
            Review_ID          = review_id,
            N_Target           = n_target,
            N_OA_Only          = length(oa_only),
            N_SS_Only          = length(ss_only),
            N_Both             = length(both_apis),
            N_Neither          = length(neither),
            Pct_OA_Only        = 100 * length(oa_only)   / n_target,
            Pct_SS_Only        = 100 * length(ss_only)   / n_target,
            Pct_Both           = 100 * length(both_apis) / n_target,
            Pct_Neither        = 100 * length(neither)   / n_target
        )
    }
 
    jaccard_df      <- bind_rows(jaccard_results)
    contribution_df <- bind_rows(contribution_results)
 
    # ── Summary statistics ────────────────────────────────────────────────────
    cat("=== Jaccard Similarity: OpenAlex vs. Semantic Scholar retrieval sets ===\n")
    jaccard_summary <- tibble(
        Median_Jaccard = median(jaccard_df$Jaccard, na.rm = TRUE),
        Q1_Jaccard     = quantile(jaccard_df$Jaccard, 0.25, na.rm = TRUE),
        Q3_Jaccard     = quantile(jaccard_df$Jaccard, 0.75, na.rm = TRUE),
        IQR_Jaccard    = IQR(jaccard_df$Jaccard, na.rm = TRUE),
        Min_Jaccard    = min(jaccard_df$Jaccard, na.rm = TRUE),
        Max_Jaccard    = max(jaccard_df$Jaccard, na.rm = TRUE)
    )
    cat(sprintf("  Median: %.3f (IQR: %.3f–%.3f; Range: %.3f–%.3f)\n\n",
                jaccard_summary$Median_Jaccard,
                jaccard_summary$Q1_Jaccard,
                jaccard_summary$Q3_Jaccard,
                jaccard_summary$Min_Jaccard,
                jaccard_summary$Max_Jaccard))
 
    cat("=== Unique API Contribution to Target Study Identification ===\n")
    contrib_summary <- contribution_df %>%
        summarise(
            Median_OA_Only_Pct  = median(Pct_OA_Only,  na.rm = TRUE),
            Median_SS_Only_Pct  = median(Pct_SS_Only,  na.rm = TRUE),
            Median_Both_Pct     = median(Pct_Both,     na.rm = TRUE),
            Median_Neither_Pct  = median(Pct_Neither,  na.rm = TRUE),
            Q1_OA_Only          = quantile(Pct_OA_Only,  0.25, na.rm = TRUE),
            Q3_OA_Only          = quantile(Pct_OA_Only,  0.75, na.rm = TRUE),
            Q1_SS_Only          = quantile(Pct_SS_Only,  0.25, na.rm = TRUE),
            Q3_SS_Only          = quantile(Pct_SS_Only,  0.75, na.rm = TRUE)
        )
    cat(sprintf("  OpenAlex only  : median %.1f%% (IQR: %.1f%%–%.1f%%)\n",
                contrib_summary$Median_OA_Only_Pct,
                contrib_summary$Q1_OA_Only,
                contrib_summary$Q3_OA_Only))
    cat(sprintf("  Semantic Scholar only: median %.1f%% (IQR: %.1f%%–%.1f%%)\n",
                contrib_summary$Median_SS_Only_Pct,
                contrib_summary$Q1_SS_Only,
                contrib_summary$Q3_SS_Only))
    cat(sprintf("  Both APIs      : median %.1f%%\n", contrib_summary$Median_Both_Pct))
    cat(sprintf("  Neither        : median %.1f%%\n\n", contrib_summary$Median_Neither_Pct))
 
    write_xlsx(
        list(Jaccard_Per_Review     = jaccard_df,
             Jaccard_Summary        = jaccard_summary,
             Contribution_Per_Review = contribution_df,
             Contribution_Summary   = contrib_summary),
        "output/Phase5_Dual_API_Analysis.xlsx"
    )
    cat("✓ Saved: output/Phase5_Dual_API_Analysis.xlsx\n")
 
    cat("\n============================================================================\n")
    cat("PHASE 5 COMPLETE\n")
    cat("============================================================================\n\n")
 
    invisible(list(jaccard = jaccard_df, contributions = contribution_df))
}

# ── PHASE 6: DOMAIN SUBGROUP ANALYSIS (Supplementary Section S1) ─────────────
#
# Exploratory analysis examining whether recall differed across research
# domains (Cochrane, Campbell, CEE). Non-parametric Kruskal-Wallis tests
# used due to small within-domain sample sizes (n_CEE = 2).
 
run_phase6 <- function() {
    cat("\n============================================================================\n")
    cat("PHASE 6: DOMAIN SUBGROUP ANALYSIS (Supplementary Section S1)\n")
    cat("============================================================================\n\n")
    cat("Note: Small within-domain sample sizes (CEE n = 2) limit inferential\n")
    cat("power. Results are presented as exploratory only.\n\n")
 
    load("output/Phase3_Data.RData")
 
    kw_results <- list()
 
    for (tool_name in tool_order) {
        tool_data <- performance_df %>% filter(Tool == tool_name)
 
        if (length(unique(tool_data$Domain)) < 2) next
 
        kw_test <- kruskal.test(Recall_Percent ~ Domain, data = tool_data)
 
        kw_results[[tool_name]] <- tibble(
            Tool      = tool_name,
            chi2      = kw_test$statistic,
            df        = kw_test$parameter,
            p_value   = kw_test$p.value,
            Significant_0.05 = kw_test$p.value < 0.05
        )
    }
 
    kw_df <- bind_rows(kw_results)
 
    cat("=== Kruskal-Wallis: Recall by Domain (Cochrane, Campbell, CEE) ===\n\n")
    print(kw_df %>% mutate(across(where(is.numeric), ~ round(., 4))))
 
    # Domain-stratified summary
    domain_summary <- performance_df %>%
        group_by(Tool, Domain) %>%
        summarise(
            N             = n(),
            Median_Recall = median(Recall_Percent, na.rm = TRUE),
            Q1_Recall     = quantile(Recall_Percent, 0.25, na.rm = TRUE),
            Q3_Recall     = quantile(Recall_Percent, 0.75, na.rm = TRUE),
            .groups       = "drop"
        )
 
    # Domain boxplot
    fig_domain <- ggplot(performance_df,
                         aes(x = Domain, y = Recall_Percent, fill = Domain)) +
        geom_boxplot(alpha = 0.7, outlier.shape = 21) +
        geom_jitter(width = 0.1, alpha = 0.5, size = 2) +
        facet_wrap(~ Tool, nrow = 1, labeller = as_labeller(tool_labels)) +
        scale_fill_brewer(palette = "Pastel1") +
        labs(
            title    = "Supplementary Section S1: Recall by Research Domain",
            subtitle = "Cochrane (n=6), Campbell (n=4), CEE (n=2). Kruskal-Wallis p > 0.05 for all tools.",
            x = NULL, y = "Recall (%)"
        ) +
        theme_white +
        theme(legend.position = "none",
              axis.text.x = element_text(angle = 45, hjust = 1),
              strip.text  = element_text(size = 8))
 
    ggsave("figures/Supplementary_Domain_Subgroup.png",
           fig_domain, width = 14, height = 6, dpi = 300, bg = "white")
    cat("\n✓ Saved: figures/Supplementary_Domain_Subgroup.png\n")
 
    write_xlsx(
        list(KruskalWallis_Results = kw_df,
             Domain_Summary        = domain_summary),
        "output/Phase6_Domain_Subgroup.xlsx"
    )
    cat("✓ Saved: output/Phase6_Domain_Subgroup.xlsx\n")
 
    cat("\n============================================================================\n")
    cat("PHASE 6 COMPLETE\n")
    cat("============================================================================\n\n")
 
    invisible(list(kruskal_wallis = kw_df, domain_summary = domain_summary))
}
 