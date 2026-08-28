# Manuscript analysis: corrected CiteChain evaluation using immutable archived search outputs.
#
# Primary estimand: retrieval of all eligible non-seed target reports,
# including reports without a DOI. Matching is exact standardized DOI followed
# by exact normalized title. Fuzzy title similarities are exported for manual
# audit and are never counted automatically.

suppressPackageStartupMessages({
  library(readxl)
  library(dplyr)
  library(tidyr)
  library(stringdist)
  library(digest)
  library(ggplot2)
  library(jsonlite)
})

options(stringsAsFactors = FALSE, scipen = 999)

script_file <- sub("^--file=", "", grep("^--file=", commandArgs(trailingOnly = FALSE), value = TRUE)[1])
SCRIPT_DIR <- dirname(normalizePath(script_file, winslash = "/", mustWork = TRUE))
TARGET_BOOK <- file.path(SCRIPT_DIR, "inputs", "CiteChain_Reviews_and_Studies.xlsx")
TOOL_DIR <- file.path(SCRIPT_DIR, "inputs", "tool_results")
SEED_ROOT <- file.path(SCRIPT_DIR, "inputs", "seed_articles")
ABSTRACT_RESULTS <- file.path(SCRIPT_DIR, "outputs")
SS_BATCH_RESPONSE <- file.path(
  SCRIPT_DIR, "inputs", "semantic_scholar",
  "semanticscholar_batch_response.json"
)
OUT <- file.path(SCRIPT_DIR, "outputs")

TOOLS <- c(
  "CiteChain_Combined", "CiteChain_OpenAlex",
  "CiteChain_SemanticScholar", "Citationchaser", "PaperFetcher"
)

TOOL_LABELS <- c(
  CiteChain_Combined = "CiteChain (Combined)",
  CiteChain_OpenAlex = "CiteChain (OpenAlex)",
  CiteChain_SemanticScholar = "CiteChain (Semantic Scholar)",
  Citationchaser = "Citationchaser",
  PaperFetcher = "PaperFetcher"
)

ESTIMANDS <- tibble::tribble(
  ~estimand, ~require_doi, ~exclude_seeds,
  "expanded_exclude_seeds", FALSE, TRUE,
  "expanded_include_seeds", FALSE, FALSE,
  "doi_exclude_seeds", TRUE, TRUE,
  "doi_include_seeds_replication", TRUE, FALSE
)

squish <- function(x) {
  x <- ifelse(is.na(x), "", as.character(x))
  trimws(gsub("\\s+", " ", x, perl = TRUE))
}

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

normalize_title <- function(x) {
  x <- squish(x)
  x <- gsub("<[^>]+>", "", x, perl = TRUE)
  ascii <- iconv(x, from = "", to = "ASCII//TRANSLIT", sub = "")
  ascii[is.na(ascii)] <- x[is.na(ascii)]
  gsub("[^a-z0-9]", "", tolower(ascii), perl = TRUE)
}

normalize_author_tokens <- function(x) {
  x <- gsub("[^a-z0-9 ]", " ", tolower(squish(x)), perl = TRUE)
  tokens <- unlist(strsplit(x, "\\s+", perl = TRUE), use.names = FALSE)
  unique(tokens[nchar(tokens) > 2])
}

usable_abstract <- function(x) {
  !(tolower(squish(x)) %in% c("", "na", "n/a", "null", "none"))
}

split_ris_records <- function(path) {
  lines <- readLines(path, warn = FALSE, encoding = "UTF-8", skipNul = TRUE)
  ends <- which(startsWith(lines, "ER  -"))
  if (!length(ends)) return(list())
  starts <- c(1L, head(ends, -1L) + 1L)
  Map(function(a, b) lines[a:b], starts, ends)
}

tag_values <- function(lines, tags) {
  prefixes <- paste0(tags, "  -")
  keep <- vapply(lines, function(x) any(startsWith(x, prefixes)), logical(1))
  if (!any(keep)) return(character())
  trimws(sub("^[A-Z0-9]{2}  -", "", lines[keep], perl = TRUE))
}

field_with_continuations <- function(lines, tag) {
  prefix <- paste0(tag, "  -")
  i <- which(startsWith(lines, prefix))[1]
  if (is.na(i)) return("")
  parts <- trimws(sub("^[A-Z0-9]{2}  -", "", lines[i], perl = TRUE))
  if (i < length(lines)) {
    for (j in seq.int(i + 1L, length(lines))) {
      if (grepl("^[A-Z0-9]{2}  -", lines[j], perl = TRUE)) break
      if (nzchar(trimws(lines[j]))) parts <- c(parts, trimws(lines[j]))
    }
  }
  squish(paste(parts, collapse = " "))
}

empty_raw_records <- function() {
  tibble(
    doi = character(), title = character(), title_norm = character(),
    year = integer(), authors = character(), abstract = character(),
    direction = character(), source_file = character(), source_position = integer()
  )
}

parse_ris <- function(path, direction) {
  records <- split_ris_records(path)
  if (!length(records)) return(empty_raw_records())
  bind_rows(lapply(seq_along(records), function(position) {
    lines <- records[[position]]
    dois <- tag_values(lines, "DO")
    titles <- tag_values(lines, c("TI", "T1"))
    years <- tag_values(lines, c("PY", "Y1"))
    authors <- tag_values(lines, c("AU", "A1"))
    year_match <- if (length(years)) regmatches(years[1], regexpr("[0-9]{4}", years[1])) else ""
    title <- squish(paste(titles, collapse = " "))
    tibble(
      doi = standardize_doi(if (length(dois)) dois[1] else ""),
      title = title,
      title_norm = normalize_title(title),
      year = if (length(year_match) && nzchar(year_match)) as.integer(year_match) else NA_integer_,
      authors = squish(paste(authors, collapse = "; ")),
      abstract = field_with_continuations(lines, "AB"),
      direction = direction,
      source_file = basename(path),
      source_position = as.integer(position)
    )
  }))
}

parse_doi_list <- function(path, direction) {
  lines <- readLines(path, warn = FALSE, encoding = "UTF-8", skipNul = TRUE)
  dois <- standardize_doi(lines)
  keep <- nzchar(dois)
  if (!any(keep)) return(empty_raw_records())
  tibble(
    doi = dois[keep], title = "", title_norm = "", year = NA_integer_,
    authors = "", abstract = "", direction = direction,
    source_file = basename(path), source_position = which(keep)
  )
}

load_tool_raw <- function(review, tool) {
  bind_rows(lapply(c("Forward", "Backward"), function(direction) {
    extension <- if (tool == "PaperFetcher") "txt" else "ris"
    path <- file.path(TOOL_DIR, paste0(review, "_", tool, "_", direction, ".", extension))
    if (!file.exists(path)) stop("Missing archived tool output: ", path)
    if (extension == "txt") parse_doi_list(path, direction) else parse_ris(path, direction)
  }))
}

canonicalize <- function(records) {
  if (!nrow(records)) {
    return(tibble(
      canonical_key = character(), doi = character(), title = character(),
      title_norm = character(), year = integer(), authors = character(),
      directions = character(), raw_occurrences = integer(),
      has_abstract = logical(), source_records = character()
    ))
  }

  title_doi <- records %>%
    filter(nzchar(title_norm), nzchar(doi)) %>%
    distinct(title_norm, doi) %>%
    count(title_norm, name = "n_dois")
  unique_title_doi <- records %>%
    filter(nzchar(title_norm), nzchar(doi)) %>%
    distinct(title_norm, doi) %>%
    inner_join(filter(title_doi, n_dois == 1L), by = "title_norm") %>%
    select(title_norm, bridge_doi = doi)

  keyed <- records %>%
    left_join(unique_title_doi, by = "title_norm") %>%
    mutate(
      bridged_doi = if_else(nzchar(doi), doi, coalesce(bridge_doi, "")),
      canonical_key = case_when(
        nzchar(bridged_doi) ~ paste0("doi:", bridged_doi),
        nzchar(title_norm) ~ paste0("title:", title_norm),
        TRUE ~ paste0("orphan:", source_file, "#", source_position)
      ),
      source_record = paste0(source_file, "#", source_position)
    )

  keyed %>%
    group_by(canonical_key) %>%
    summarise(
      doi = first(bridged_doi),
      title = { z <- title[nzchar(title)]; if (length(z)) z[1] else "" },
      title_norm = { z <- title_norm[nzchar(title_norm)]; if (length(z)) z[1] else "" },
      year = { z <- year[!is.na(year)]; if (length(z)) as.integer(z[1]) else NA_integer_ },
      authors = { z <- authors[nzchar(authors)]; if (length(z)) z[1] else "" },
      directions = paste(unique(direction), collapse = ";"),
      raw_occurrences = n(),
      has_abstract = any(usable_abstract(abstract)),
      source_records = paste(source_record, collapse = ";"),
      .groups = "drop"
    )
}

REFERENCE_CORRECTIONS <- tibble::tribble(
  ~review, ~study_id, ~corrected_doi, ~corrected_title, ~corrected_authors, ~corrected_year, ~corrected_journal, ~decision,
  "R01", "R01_S039", "10.1002/gps.2126", "Helping carers to care--the 10/66 dementia research group's randomized control trial of a caregiver intervention in Russia.", "Gavrilova", 2009L, "International Journal of Geriatric Psychiatry", "CORRECT_WRONG_DOI",
  "R01", "R01_S102", "10.1016/S0140-6736(09)62042-0", "Effect of a participatory intervention with women's groups on birth outcomes and maternal depression in Jharkhand and Orissa, India: a cluster-randomised controlled trial", "Tripathy", 2010L, "Lancet", "CORRECT_WRONG_DOI",
  "R02", "R02_S032", "10.1016/j.ekir.2020.02.830", "SUN-293 Low-dose valganciclovir is as effective as the standard dose prophylaxis for cytomegalovirus in renal transplant recipients", "Prabakaran", 2020L, "Kidney International Reports", "CORRECT_WRONG_DOI",
  "R04", "R04_S005", "10.1002/bjs.8781", "Randomized clinical trial of ultrasound-guided foam sclerotherapy versus surgery for the incompetent great saphenous vein", "Shadid", 2012L, "British Journal of Surgery", "CORRECT_COMMENTARY_DOI"
)

load_targets_and_seeds <- function() {
  corrections <- REFERENCE_CORRECTIONS %>%
    mutate(
      corrected_doi = standardize_doi(corrected_doi),
      corrected_title = squish(corrected_title),
      corrected_authors = squish(corrected_authors),
      corrected_journal = squish(corrected_journal),
      corrected_year = suppressWarnings(as.integer(corrected_year)),
      has_correction = !is.na(decision) & nzchar(squish(decision))
    )
  targets <- vector("list", 12L)
  names(targets) <- sprintf("R%02d", 1:12)
  seed_counts <- integer(12L)
  for (n in 1:12) {
    review <- sprintf("R%02d", n)
    target <- read_excel(TARGET_BOOK, sheet = sprintf("R_%02d", n)) %>%
      filter(!is.na(Study_ID), nzchar(squish(Study_ID))) %>%
      transmute(
        review = review,
        study_id = squish(Study_ID),
        doi = standardize_doi(DOI),
        title = squish(Title),
        title_norm = normalize_title(Title),
        authors = squish(Authors),
        year = suppressWarnings(as.integer(Year)),
        tertile = squish(Tertile)
      ) %>%
      left_join(corrections, by = c("review", "study_id")) %>%
      mutate(
        doi = if_else(coalesce(has_correction, FALSE), corrected_doi, doi),
        title = if_else(!is.na(corrected_title) & nzchar(corrected_title), corrected_title, title),
        title_norm = normalize_title(title),
        authors = if_else(!is.na(corrected_authors) & nzchar(corrected_authors), corrected_authors, authors),
        year = if_else(!is.na(corrected_year), corrected_year, year)
      ) %>%
      select(review, study_id, doi, title, title_norm, authors, year, tertile)
    seed_path <- file.path(SEED_ROOT, review, "Seed_Articles.xlsx")
    seed_ids <- read_excel(seed_path) %>%
      filter(!is.na(Study_ID), nzchar(squish(Study_ID))) %>%
      pull(Study_ID) %>% squish() %>% unique()
    target$is_seed <- target$study_id %in% seed_ids
    targets[[review]] <- target
    seed_counts[n] <- length(seed_ids)
  }
  list(targets = targets, seed_count = sum(seed_counts))
}

match_targets <- function(targets, citations, generate_fuzzy = TRUE) {
  matches <- list()
  candidates <- list()
  mi <- 0L
  ci <- 0L
  citation_titles <- unique(citations$title_norm[nzchar(citations$title_norm)])

  for (i in seq_len(nrow(targets))) {
    target <- targets[i, ]
    hit_idx <- integer()
    method <- ""
    if (nzchar(target$doi)) {
      hit_idx <- which(citations$doi == target$doi)
      if (length(hit_idx)) method <- "doi"
    }
    if (!length(hit_idx) && nzchar(target$title_norm)) {
      hit_idx <- which(citations$title_norm == target$title_norm)
      if (length(hit_idx)) method <- "exact_normalized_title"
    }
    if (length(hit_idx)) {
      hits <- citations[hit_idx, ]
      dirs <- unique(unlist(strsplit(hits$directions, ";", fixed = TRUE), use.names = FALSE))
      mi <- mi + 1L
      matches[[mi]] <- tibble(
        study_id = target$study_id,
        method = method,
        citation_keys = paste(sort(unique(hits$canonical_key)), collapse = ";"),
        directions = paste(sort(unique(dirs[nzchar(dirs)])), collapse = ";")
      )
    } else if (generate_fuzzy && nzchar(target$title_norm) && length(citation_titles)) {
      similarities <- as.numeric(stringsim(target$title_norm, citation_titles, method = "lv")) * 100
      ord <- head(order(similarities, decreasing = TRUE), 3L)
      ord <- ord[similarities[ord] >= 70]
      for (j in ord) {
        candidate <- citations[match(citation_titles[j], citations$title_norm), ]
        year_diff <- if (!is.na(target$year) && !is.na(candidate$year)) abs(target$year - candidate$year) else NA_integer_
        author_overlap <- length(intersect(
          normalize_author_tokens(target$authors),
          normalize_author_tokens(candidate$authors)
        ))
        ci <- ci + 1L
        candidates[[ci]] <- tibble(
          study_id = target$study_id,
          target_doi = target$doi,
          target_title = target$title,
          target_authors = target$authors,
          target_year = target$year,
          candidate_doi = candidate$doi,
          candidate_title = candidate$title,
          candidate_title_norm = candidate$title_norm,
          candidate_authors = candidate$authors,
          candidate_year = candidate$year,
          title_similarity = similarities[j],
          year_difference = year_diff,
          author_token_overlap = author_overlap,
          algorithmic_status = "NOT_COUNTED_REQUIRES_MANUAL_ADJUDICATION"
        )
      }
    }
  }
  list(matches = bind_rows(matches), candidates = bind_rows(candidates))
}

paired_rank_biserial <- function(differences) {
  differences <- differences[!is.na(differences) & differences != 0]
  if (!length(differences)) return(0)
  ranks <- rank(abs(differences), ties.method = "average")
  positive <- sum(ranks[differences > 0])
  negative <- sum(ranks[differences < 0])
  (positive - negative) / (positive + negative)
}

inferential_tests <- function(performance, estimand_name) {
  wide <- performance %>%
    filter(estimand == estimand_name) %>%
    select(review, tool, recall_percent) %>%
    pivot_wider(names_from = tool, values_from = recall_percent) %>%
    arrange(review)
  matrix_values <- as.matrix(wide[, TOOLS])
  fried <- friedman.test(matrix_values)
  n <- nrow(matrix_values)
  k <- ncol(matrix_values)
  friedman <- tibble(
    estimand = estimand_name,
    n_reviews = n,
    n_tools = k,
    friedman_chi_square = unname(fried$statistic),
    df = unname(fried$parameter),
    p_value = fried$p.value,
    kendalls_w = unname(fried$statistic) / (n * (k - 1)),
    assumptions_note = "complete paired review blocks; reviews treated as independent; rank-based test"
  )

  rows <- list()
  ri <- 0L
  for (i in seq_len(length(TOOLS) - 1L)) {
    for (j in seq.int(i + 1L, length(TOOLS))) {
      a <- TOOLS[i]
      b <- TOOLS[j]
      diff <- matrix_values[, a] - matrix_values[, b]
      if (all(abs(diff) < .Machine$double.eps^0.5)) {
        statistic <- 0
        p_raw <- 1
      } else {
        test <- suppressWarnings(wilcox.test(
          matrix_values[, a], matrix_values[, b], paired = TRUE,
          exact = FALSE, correct = FALSE, alternative = "two.sided"
        ))
        statistic <- unname(test$statistic)
        p_raw <- test$p.value
      }
      ri <- ri + 1L
      rows[[ri]] <- tibble(
        estimand = estimand_name,
        tool_1 = a,
        tool_2 = b,
        n_pairs = n,
        n_nonzero_pairs = sum(diff != 0),
        wilcoxon_v = statistic,
        p_raw = p_raw,
        paired_rank_biserial = paired_rank_biserial(diff),
        median_paired_difference_percentage_points = median(diff)
      )
    }
  }
  pairwise <- bind_rows(rows) %>%
    mutate(
      p_bonferroni = p.adjust(p_raw, method = "bonferroni"),
      p_holm = p.adjust(p_raw, method = "holm"),
      significant_bonferroni_0_05 = p_bonferroni < 0.05,
      significant_holm_0_05 = p_holm < 0.05
    )
  list(friedman = friedman, pairwise = pairwise)
}

summarize_performance <- function(performance) {
  performance %>%
    group_by(estimand, tool) %>%
    summarise(
      n_reviews = n(),
      median_target = median(n_target),
      median_recall_percent = median(recall_percent),
      q1_recall_percent = quantile(recall_percent, 0.25, names = FALSE, type = 7),
      q3_recall_percent = quantile(recall_percent, 0.75, names = FALSE, type = 7),
      min_recall_percent = min(recall_percent),
      max_recall_percent = max(recall_percent),
      mean_recall_percent = mean(recall_percent),
      sd_recall_percent = sd(recall_percent),
      median_unique_citations = median(unique_citations),
      median_screening_burden = median(screening_burden),
      median_nnr = median(nnr, na.rm = TRUE),
      total_true_positives = sum(true_positives),
      .groups = "drop"
    )
}

write_csv_utf8 <- function(x, path) {
  write.csv(x, path, row.names = FALSE, na = "", fileEncoding = "UTF-8")
}

dir.create(OUT, recursive = TRUE, showWarnings = FALSE)
manual_adjudications <- tibble::tribble(
  ~review, ~tool, ~study_id, ~candidate_title_norm, ~decision, ~rationale,
  "R03", "CiteChain_Combined", "R03_S008", "acomparisonoftheeffectsoftransdermalestradiolandestradiolvalerateonendometrialreceptivityinfrozenthawedembryotransfercyclesarandomizedclinicaltrial", "ACCEPT", "Same report: title, 2016 year, and Davar authorship agree.",
  "R03", "CiteChain_OpenAlex", "R03_S008", "acomparisonoftheeffectsoftransdermalestradiolandestradiolvalerateonendometrialreceptivityinfrozenthawedembryotransfercyclesarandomizedclinicaltrial", "ACCEPT", "Same report: title, 2016 year, and Davar authorship agree.",
  "R03", "CiteChain_SemanticScholar", "R03_S008", "acomparisonoftheeffectsoftransdermalestradiolandestradiolvalerateonendometrialreceptivityinfrozenthawedembryotransfercyclesarandomizedclinicaltrial", "ACCEPT", "Same report: title, 2016 year, and Davar authorship agree.",
  "R03", "Citationchaser", "R03_S008", "acomparisonoftheeffectsoftransdermalestradiolandestradiolvalerateonendometrialreceptivityinfrozenthawedembryotransfercyclesarandomizedclinicaltrial", "ACCEPT", "Same report: title, 2016 year, and Davar authorship agree."
)
required_adjudication_columns <- c(
  "review", "tool", "study_id", "candidate_title_norm", "decision", "rationale"
)
if (!all(required_adjudication_columns %in% names(manual_adjudications))) {
  stop("Manual adjudication file has missing required columns")
}
if (any(!manual_adjudications$decision %in% c("ACCEPT", "REJECT"))) {
  stop("Manual adjudication decisions must be ACCEPT or REJECT")
}

apply_manual_adjudications <- function(matches, review, tool, citations) {
  accepted <- manual_adjudications %>%
    filter(
      .data$review == .env$review,
      .data$tool == .env$tool,
      .data$decision == "ACCEPT"
    )
  if (!nrow(accepted)) return(matches)
  additions <- list()
  ai <- 0L
  existing_ids <- if (nrow(matches)) matches$study_id else character()
  for (i in seq_len(nrow(accepted))) {
    rule <- accepted[i, ]
    if (rule$study_id %in% existing_ids) next
    hits <- citations[citations$title_norm == rule$candidate_title_norm, , drop = FALSE]
    if (!nrow(hits)) next
    dirs <- unique(unlist(strsplit(hits$directions, ";", fixed = TRUE), use.names = FALSE))
    ai <- ai + 1L
    additions[[ai]] <- tibble(
      study_id = rule$study_id,
      method = "manual_adjudicated_title",
      citation_keys = paste(sort(unique(hits$canonical_key)), collapse = ";"),
      directions = paste(sort(unique(dirs[nzchar(dirs)])), collapse = ";")
    )
  }
  bind_rows(matches, bind_rows(additions))
}

loaded <- load_targets_and_seeds()
targets_by_review <- loaded$targets
target_count <- sum(vapply(targets_by_review, nrow, integer(1)))
seed_count <- loaded$seed_count
if (target_count != 645L || seed_count != 72L) {
  stop(sprintf("Unexpected target/seed counts: %d/%d", target_count, seed_count))
}

performance_rows <- list()
match_rows <- list()
fuzzy_rows <- list()
dedup_rows <- list()
direction_rows <- list()
contribution_rows <- list()
canonical_cache <- list()
pi <- mi <- fi <- di <- dri <- ci <- 0L

for (review in names(targets_by_review)) {
  all_targets <- targets_by_review[[review]]
  for (tool in TOOLS) {
    message("Processing ", review, " / ", tool)
    raw <- load_tool_raw(review, tool)
    canonical <- canonicalize(raw)
    cache_key <- paste(review, tool, sep = "|")
    canonical_cache[[cache_key]] <- canonical

    di <- di + 1L
    dedup_rows[[di]] <- tibble(
      review = review,
      tool = tool,
      raw_records = nrow(raw),
      canonical_unique_citations = nrow(canonical),
      duplicates_collapsed = nrow(raw) - nrow(canonical),
      records_with_doi = sum(nzchar(canonical$doi)),
      records_without_doi = sum(!nzchar(canonical$doi))
    )

    match_result <- match_targets(all_targets, canonical, generate_fuzzy = TRUE)
    matches <- apply_manual_adjudications(match_result$matches, review, tool, canonical)
    match_ids <- if (nrow(matches)) matches$study_id else character()
    if (nrow(matches)) {
      mi <- mi + 1L
      match_rows[[mi]] <- all_targets %>%
        inner_join(matches, by = "study_id") %>%
        mutate(tool = tool, .after = review)
    }
    if (nrow(match_result$candidates)) {
      fi <- fi + 1L
      fuzzy_rows[[fi]] <- match_result$candidates %>%
        mutate(review = review, tool = tool, .before = 1)
    }

    for (e in seq_len(nrow(ESTIMANDS))) {
      rules <- ESTIMANDS[e, ]
      eligible <- all_targets %>%
        filter((!rules$require_doi | nzchar(doi)) & (!rules$exclude_seeds | !is_seed))
      tp <- sum(eligible$study_id %in% match_ids)
      n_target <- nrow(eligible)
      pi <- pi + 1L
      performance_rows[[pi]] <- tibble(
        review = review,
        tool = tool,
        tool_label = unname(TOOL_LABELS[tool]),
        estimand = rules$estimand,
        n_target = n_target,
        true_positives = tp,
        recall_percent = 100 * tp / n_target,
        unique_citations = nrow(canonical),
        screening_burden = nrow(canonical) - tp,
        nnr = if (tp > 0) nrow(canonical) / tp else NA_real_
      )
    }

    primary_targets <- filter(all_targets, !is_seed)
    primary_ids <- primary_targets$study_id
    direction_hits <- list()
    for (direction in c("Forward", "Backward")) {
      direction_citations <- canonicalize(filter(raw, .data$direction == .env$direction))
      direction_match <- match_targets(primary_targets, direction_citations, generate_fuzzy = FALSE)$matches
      direction_match <- apply_manual_adjudications(
        direction_match, review, tool, direction_citations
      )
      ids <- if (nrow(direction_match)) direction_match$study_id else character()
      direction_hits[[direction]] <- ids
      dri <- dri + 1L
      direction_rows[[dri]] <- tibble(
        review = review,
        tool = tool,
        direction = direction,
        n_target = nrow(primary_targets),
        true_positives = length(ids),
        recall_percent = 100 * length(ids) / nrow(primary_targets),
        unique_citations = nrow(direction_citations)
      )
    }
    fwd <- direction_hits$Forward
    bwd <- direction_hits$Backward
    ci <- ci + 1L
    contribution_rows[[ci]] <- tibble(
      review = review,
      tool = tool,
      n_target = nrow(primary_targets),
      forward_only = length(setdiff(fwd, bwd)),
      backward_only = length(setdiff(bwd, fwd)),
      both = length(intersect(fwd, bwd)),
      neither = length(setdiff(primary_ids, union(fwd, bwd))),
      pct_forward_only = 100 * forward_only / n_target,
      pct_backward_only = 100 * backward_only / n_target,
      pct_both = 100 * both / n_target,
      pct_neither = 100 * neither / n_target
    )
  }
}

performance <- bind_rows(performance_rows)
all_matches <- bind_rows(match_rows)
summary <- summarize_performance(performance)
tests <- lapply(ESTIMANDS$estimand, function(x) inferential_tests(performance, x))
friedman_results <- bind_rows(lapply(tests, `[[`, "friedman"))
pairwise_results <- bind_rows(lapply(tests, `[[`, "pairwise"))

directions <- bind_rows(direction_rows)
direction_summary <- directions %>%
  group_by(tool, direction) %>%
  summarise(
    median_recall_percent = median(recall_percent),
    q1_recall_percent = quantile(recall_percent, 0.25, names = FALSE, type = 7),
    q3_recall_percent = quantile(recall_percent, 0.75, names = FALSE, type = 7),
    median_unique_citations = median(unique_citations),
    .groups = "drop"
  )

direction_tests <- bind_rows(lapply(TOOLS, function(tool_name) {
  wide <- directions %>%
    filter(tool == tool_name) %>%
    select(review, direction, recall_percent) %>%
    pivot_wider(names_from = direction, values_from = recall_percent) %>%
    arrange(review)
  diff <- wide$Forward - wide$Backward
  if (all(abs(diff) < .Machine$double.eps^0.5)) {
    statistic <- 0
    p_raw <- 1
  } else {
    test <- suppressWarnings(wilcox.test(
      wide$Forward, wide$Backward, paired = TRUE,
      exact = FALSE, correct = FALSE, alternative = "two.sided"
    ))
    statistic <- unname(test$statistic)
    p_raw <- test$p.value
  }
  tibble(
    tool = tool_name,
    n_pairs = nrow(wide),
    n_nonzero_pairs = sum(diff != 0),
    median_forward = median(wide$Forward),
    median_backward = median(wide$Backward),
    wilcoxon_v = statistic,
    p_raw = p_raw,
    paired_rank_biserial = paired_rank_biserial(diff)
  )
})) %>%
  mutate(
    p_bonferroni = p.adjust(p_raw, method = "bonferroni"),
    p_holm = p.adjust(p_raw, method = "holm")
  )

contributions <- bind_rows(contribution_rows)
contribution_summary <- contributions %>%
  group_by(tool) %>%
  summarise(
    median_pct_forward_only = median(pct_forward_only),
    median_pct_backward_only = median(pct_backward_only),
    median_pct_both = median(pct_both),
    median_pct_neither = median(pct_neither),
    .groups = "drop"
  )

dual_api_by_review <- bind_rows(lapply(names(targets_by_review), function(review) {
  oa_citations <- canonical_cache[[paste(review, "CiteChain_OpenAlex", sep = "|")]]
  ss_citations <- canonical_cache[[paste(review, "CiteChain_SemanticScholar", sep = "|")]]
  oa_keys <- unique(oa_citations$canonical_key)
  ss_keys <- unique(ss_citations$canonical_key)
  union_keys <- union(oa_keys, ss_keys)

  primary_ids <- targets_by_review[[review]] %>%
    filter(!is_seed) %>%
    pull(study_id)
  oa_hits <- all_matches %>%
    filter(.data$review == .env$review, tool == "CiteChain_OpenAlex", !is_seed) %>%
    pull(study_id) %>% unique()
  ss_hits <- all_matches %>%
    filter(.data$review == .env$review, tool == "CiteChain_SemanticScholar", !is_seed) %>%
    pull(study_id) %>% unique()

  tibble(
    review = review,
    retrieval_jaccard = if (length(union_keys)) length(intersect(oa_keys, ss_keys)) / length(union_keys) else NA_real_,
    n_target = length(primary_ids),
    openalex_only = length(setdiff(oa_hits, ss_hits)),
    semantic_scholar_only = length(setdiff(ss_hits, oa_hits)),
    both_apis = length(intersect(oa_hits, ss_hits)),
    neither_api = length(setdiff(primary_ids, union(oa_hits, ss_hits))),
    pct_openalex_only = 100 * openalex_only / n_target,
    pct_semantic_scholar_only = 100 * semantic_scholar_only / n_target,
    pct_both_apis = 100 * both_apis / n_target,
    pct_neither_api = 100 * neither_api / n_target
  )
}))

dual_api_summary <- dual_api_by_review %>%
  summarise(
    median_retrieval_jaccard = median(retrieval_jaccard),
    q1_retrieval_jaccard = quantile(retrieval_jaccard, 0.25, names = FALSE, type = 7),
    q3_retrieval_jaccard = quantile(retrieval_jaccard, 0.75, names = FALSE, type = 7),
    median_pct_openalex_only = median(pct_openalex_only),
    median_pct_semantic_scholar_only = median(pct_semantic_scholar_only),
    median_pct_both_apis = median(pct_both_apis),
    median_pct_neither_api = median(pct_neither_api)
  )

if (!file.exists(SS_BATCH_RESPONSE)) {
  stop("Missing archived Semantic Scholar batch response: ", SS_BATCH_RESPONSE)
}
ss_batch <- jsonlite::fromJSON(SS_BATCH_RESPONSE, simplifyVector = FALSE)
ss_non_null <- vapply(ss_batch, is.list, logical(1))
has_reference_elision_notice <- vapply(ss_batch, function(record) {
  if (!is.list(record)) return(FALSE)
  disclaimer <- record$openAccessPdf$disclaimer
  if (is.null(disclaimer)) return(FALSE)
  grepl("elided by the publisher", disclaimer, ignore.case = TRUE) &&
    grepl("references", disclaimer, ignore.case = TRUE)
}, logical(1))
has_reference_list <- vapply(ss_batch, function(record) {
  is.list(record) && !is.null(record$references) && length(record$references) > 0L
}, logical(1))
ss_reference_elision_summary <- tibble(
  submitted_seed_responses = length(ss_batch),
  non_null_responses = sum(ss_non_null),
  null_responses = sum(!ss_non_null),
  reference_elision_notices = sum(has_reference_elision_notice),
  reference_elision_percent_of_submitted = 100 * sum(has_reference_elision_notice) / length(ss_batch),
  responses_with_nonempty_reference_lists = sum(has_reference_list)
)

fuzzy_candidates <- bind_rows(fuzzy_rows) %>%
  left_join(
    manual_adjudications,
    by = c("review", "tool", "study_id", "candidate_title_norm")
  ) %>%
  mutate(
    decision = coalesce(decision, "REJECT_NOT_COUNTED"),
    rationale = coalesce(
      rationale,
      "Insufficient combined title, year, and author evidence for manual confirmation."
    )
  )

corrected <- read.csv(
  file.path(ABSTRACT_RESULTS, "review_abstract_coverage_summary.csv"),
  check.names = FALSE, stringsAsFactors = FALSE, fileEncoding = "UTF-8-BOM"
)
total_corrected <- corrected[corrected$review == "TOTAL", , drop = FALSE]
if (nrow(total_corrected) != 1L) stop("Expected one TOTAL row in corrected abstract coverage summary")

# Record-level abstract coverage. All three CiteChain modes use the same May
# record linkage and DS abstract-source classification. Citationchaser uses
# its raw RIS AB fields. PaperFetcher exported DOI-only text files, so its
# abstract coverage is not calculable and must not be represented as zero.
citechain_mode_coverage <- read.csv(
  file.path(ABSTRACT_RESULTS, "citechain_mode_abstract_coverage_summary.csv"),
  stringsAsFactors = FALSE
) %>%
  transmute(
    tool,
    denominator = as.integer(denominator),
    records_with_abstract = as.integer(records_with_abstract),
    abstract_coverage_percent = as.numeric(abstract_coverage_percent),
    coverage_status = "calculable",
    evidence = "record-level abstract assessment linked to the corresponding mode-specific record set"
  )
citationchaser_cached <- lapply(names(targets_by_review), function(review) {
  canonical_cache[[paste(review, "Citationchaser", sep = "|")]]
})
citationchaser_denominator <- sum(vapply(citationchaser_cached, nrow, integer(1)))
citationchaser_numerator <- sum(vapply(
  citationchaser_cached, function(x) sum(x$has_abstract), integer(1)
))
citationchaser_coverage <- tibble(
  tool = "Citationchaser",
  denominator = citationchaser_denominator,
  records_with_abstract = citationchaser_numerator,
  abstract_coverage_percent = 100 * citationchaser_numerator / citationchaser_denominator,
  coverage_status = "calculable",
  evidence = "record-level AB field in raw RIS output after canonical deduplication"
)
paperfetcher_denominator <- sum(vapply(names(targets_by_review), function(review) {
  nrow(canonical_cache[[paste(review, "PaperFetcher", sep = "|")]])
}, integer(1)))
record_level_coverage <- bind_rows(
  citechain_mode_coverage,
  citationchaser_coverage,
  tibble(
    tool = "PaperFetcher",
    denominator = paperfetcher_denominator,
    records_with_abstract = NA_integer_,
    abstract_coverage_percent = NA_real_,
    coverage_status = "not_calculable",
    evidence = "DOI-only text output contains no abstract field"
  )
)

outputs <- list(
  "performance_by_review_and_estimand.csv" = performance,
  "performance_summary.csv" = summary,
  "target_matches.csv" = bind_rows(match_rows),
  "fuzzy_candidate_adjudication.csv" = fuzzy_candidates,
  "deduplication_audit.csv" = bind_rows(dedup_rows),
  "friedman_tests.csv" = friedman_results,
  "pairwise_wilcoxon.csv" = pairwise_results,
  "direction_by_review.csv" = directions,
  "direction_summary.csv" = direction_summary,
  "direction_tests.csv" = direction_tests,
  "direction_contribution_by_review.csv" = contributions,
  "direction_contribution_summary.csv" = contribution_summary,
  "dual_api_overlap_by_review.csv" = dual_api_by_review,
  "dual_api_overlap_summary.csv" = dual_api_summary,
  "semantic_scholar_reference_elision_summary.csv" = ss_reference_elision_summary,
  "record_level_abstract_coverage_by_tool.csv" = record_level_coverage
)
invisible(lapply(
  names(outputs),
  function(name) write_csv_utf8(outputs[[name]], file.path(OUT, name))
))

input_paths <- c(
  TARGET_BOOK,
  file.path(SEED_ROOT, sprintf("R%02d", 1:12), "Seed_Articles.xlsx"),
  sort(list.files(TOOL_DIR, full.names = TRUE)),
  file.path(ABSTRACT_RESULTS, "review_abstract_coverage_summary.csv"),
  SS_BATCH_RESPONSE
)
manifest <- tibble(
  path = {
    normalized <- normalizePath(input_paths, winslash = "/", mustWork = TRUE)
    package_root <- paste0(normalizePath(SCRIPT_DIR, winslash = "/", mustWork = TRUE), "/")
    ifelse(startsWith(normalized, package_root), substring(normalized, nchar(package_root) + 1L), normalized)
  },
  bytes = as.numeric(file.info(input_paths)$size),
  sha256 = vapply(input_paths, digest, character(1), algo = "sha256", file = TRUE)
)
write_csv_utf8(manifest, file.path(OUT, "input_manifest.csv"))

denominator_check <- performance %>%
  group_by(estimand, review) %>%
  summarise(n_target = first(n_target), .groups = "drop") %>%
  group_by(estimand) %>%
  summarise(total_target = sum(n_target), .groups = "drop")
write_csv_utf8(denominator_check, file.path(OUT, "estimand_denominator_check.csv"))

expected_denominators <- c(
  expanded_exclude_seeds = 573L,
  expanded_include_seeds = 645L,
  doi_exclude_seeds = 490L,
  doi_include_seeds_replication = 562L
)
observed_denominators <- setNames(denominator_check$total_target, denominator_check$estimand)
if (!all(observed_denominators[names(expected_denominators)] == expected_denominators)) {
  stop("Estimand denominator check failed; see estimand_denominator_check.csv")
}

primary <- filter(summary, estimand == "expanded_exclude_seeds")
replication <- filter(summary, estimand == "doi_include_seeds_replication")
f_primary <- filter(friedman_results, estimand == "expanded_exclude_seeds")

# Manuscript figures use the primary estimand only. TIFF files are intended for
# journal submission; PNG files are convenient for insertion into the manuscript.
plot_order <- TOOLS
plot_labels <- c(
  CiteChain_Combined = "CiteChain\n(Combined)",
  CiteChain_OpenAlex = "CiteChain\n(OpenAlex)",
  CiteChain_SemanticScholar = "CiteChain\n(Semantic Scholar)",
  Citationchaser = "Citationchaser",
  PaperFetcher = "PaperFetcher"
)
plot_colors <- c(
  CiteChain_Combined = "#69C3AA",
  CiteChain_OpenAlex = "#FC8D62",
  CiteChain_SemanticScholar = "#8DA0CB",
  Citationchaser = "#E78AC3",
  PaperFetcher = "#A6D854"
)

primary_review <- performance %>%
  filter(estimand == "expanded_exclude_seeds") %>%
  mutate(tool = factor(tool, levels = plot_order))

figure3 <- ggplot(primary_review, aes(x = tool, y = recall_percent, fill = tool)) +
  geom_boxplot(width = 0.62, outlier.shape = NA, linewidth = 0.55, alpha = 0.72) +
  geom_point(
    position = position_jitter(width = 0.10, height = 0, seed = 20260410),
    size = 2.0, alpha = 0.72, color = "#333333"
  ) +
  scale_fill_manual(values = plot_colors, guide = "none") +
  scale_x_discrete(labels = plot_labels) +
  scale_y_continuous(
    name = "Recall (%)", limits = c(0, 90), breaks = seq(0, 90, 10),
    expand = expansion(mult = c(0, 0.02))
  ) +
  labs(
    title = "Recall distribution across reviews by tool",
    subtitle = "Primary estimand: 573 eligible non-seed reports across 12 systematic reviews",
    x = NULL
  ) +
  theme_minimal(base_size = 11) +
  theme(
    plot.title = element_text(face = "bold", size = 13),
    plot.subtitle = element_text(size = 10),
    axis.text.x = element_text(size = 9, lineheight = 0.95),
    panel.grid.minor = element_blank(),
    panel.grid.major.x = element_blank(),
    plot.margin = margin(10, 14, 10, 10)
  )

figure4_data <- primary %>%
  mutate(
    tool = factor(tool, levels = plot_order),
    label = unname(plot_labels[tool]),
    label_x = median_recall_percent + c(0.1, -0.1, 0.6, -0.7, 0.6)[match(tool, plot_order)],
    label_y = median_screening_burden + c(16, -15, -8, 8, 6)[match(tool, plot_order)]
  )

figure4 <- ggplot(
  figure4_data,
  aes(x = median_recall_percent, y = median_screening_burden, color = tool)
) +
  geom_point(size = 4.2, alpha = 0.95) +
  geom_text(
    aes(x = label_x, y = label_y, label = label),
    color = "#222222", size = 3.2, lineheight = 0.9
  ) +
  scale_color_manual(values = plot_colors, guide = "none") +
  scale_x_continuous(name = "Median recall (%)", limits = c(17, 30), breaks = seq(18, 30, 2)) +
  scale_y_continuous(
    name = "Median screening burden (records)",
    limits = c(250, 560), breaks = seq(250, 550, 50)
  ) +
  labs(
    title = "Recall-screening burden trade-off",
    subtitle = "Each point represents median values across 12 systematic reviews"
  ) +
  theme_minimal(base_size = 11) +
  theme(
    plot.title = element_text(face = "bold", size = 13),
    plot.subtitle = element_text(size = 10),
    panel.grid.minor = element_blank(),
    plot.margin = margin(10, 18, 10, 10)
  )

save_figure <- function(plot, stem, width, height) {
  ggsave(file.path(OUT, paste0(stem, ".png")), plot, width = width, height = height,
         units = "in", dpi = 300, bg = "white")
  ggsave(file.path(OUT, paste0(stem, ".tiff")), plot, width = width, height = height,
         units = "in", dpi = 600, compression = "lzw", bg = "white")
}
save_figure(figure3, "Figure3_primary_recall_distribution", 7.2, 5.0)
save_figure(figure4, "Figure4_primary_recall_screening_burden", 7.2, 5.0)

figure5_data <- contribution_summary %>%
  select(
    tool,
    `Forward only` = median_pct_forward_only,
    `Backward only` = median_pct_backward_only,
    `Both directions` = median_pct_both
  ) %>%
  pivot_longer(-tool, names_to = "contribution", values_to = "median_percent") %>%
  mutate(
    tool = factor(tool, levels = plot_order),
    contribution = factor(
      contribution,
      levels = c("Forward only", "Backward only", "Both directions")
    )
  )

direction_colors <- c(
  `Forward only` = "#4C9BE8",
  `Backward only` = "#E9825B",
  `Both directions` = "#68B96B"
)
figure5 <- ggplot(
  figure5_data,
  aes(x = tool, y = median_percent, fill = contribution)
) +
  geom_col(position = position_dodge(width = 0.78), width = 0.70) +
  geom_text(
    aes(label = sprintf("%.1f", median_percent)),
    position = position_dodge(width = 0.78), vjust = -0.35, size = 3.0
  ) +
  scale_fill_manual(values = direction_colors, name = NULL) +
  scale_x_discrete(labels = plot_labels) +
  scale_y_continuous(
    name = "Median proportion of target reports (%)",
    limits = c(0, 18), breaks = seq(0, 18, 3),
    expand = expansion(mult = c(0, 0.02))
  ) +
  labs(
    title = "Direction-specific contribution to target-report retrieval",
    subtitle = "Primary estimand: medians across 12 systematic reviews",
    x = NULL
  ) +
  theme_minimal(base_size = 11) +
  theme(
    plot.title = element_text(face = "bold", size = 13),
    plot.subtitle = element_text(size = 10),
    axis.text.x = element_text(size = 9, lineheight = 0.95),
    legend.position = "top",
    panel.grid.minor = element_blank(),
    panel.grid.major.x = element_blank(),
    plot.margin = margin(10, 14, 10, 10)
  )
save_figure(figure5, "Figure5_directional_contribution", 7.2, 5.0)

direction_plot_data <- directions %>%
  mutate(
    tool = factor(tool, levels = plot_order),
    direction = factor(direction, levels = c("Forward", "Backward"))
  )
figure_s2 <- ggplot(
  direction_plot_data,
  aes(x = tool, y = recall_percent, fill = direction)
) +
  geom_boxplot(
    position = position_dodge(width = 0.72), width = 0.60,
    outlier.shape = NA, linewidth = 0.5, alpha = 0.72
  ) +
  geom_point(
    aes(color = direction),
    position = position_jitterdodge(
      jitter.width = 0.08, dodge.width = 0.72, seed = 20260410
    ),
    size = 1.7, alpha = 0.65
  ) +
  scale_fill_manual(values = c(Forward = "#4C9BE8", Backward = "#E9825B"), name = NULL) +
  scale_color_manual(values = c(Forward = "#2E6EA8", Backward = "#A84D2E"), guide = "none") +
  scale_x_discrete(labels = plot_labels) +
  scale_y_continuous(
    name = "Direction-specific recall (%)", limits = c(0, 80),
    breaks = seq(0, 80, 10), expand = expansion(mult = c(0.025, 0.02))
  ) +
  labs(
    title = "Recall by citation-search direction",
    subtitle = "Primary estimand: 573 eligible non-seed reports across 12 systematic reviews",
    x = NULL
  ) +
  theme_minimal(base_size = 11) +
  theme(
    plot.title = element_text(face = "bold", size = 13),
    plot.subtitle = element_text(size = 10),
    axis.text.x = element_text(size = 9, lineheight = 0.95),
    legend.position = "top",
    panel.grid.minor = element_blank(),
    panel.grid.major.x = element_blank(),
    plot.margin = margin(10, 14, 10, 10)
  )
save_figure(figure_s2, "Supplementary_Figure_S2_direction_recall", 7.2, 5.0)

report <- c(
  "# Revised CiteChain evaluation: results brief",
  "",
  "## Estimands",
  "",
  "Primary: all eligible non-seed target reports, including non-DOI reports (573 targets overall).",
  "Sensitivity analyses: expanded seed-inclusive; DOI-only seed-excluded; original DOI-only seed-inclusive estimand.",
  "",
  "## Primary performance",
  "",
  "| Tool | Median recall, % (IQR) | Median unique citations | Median NNR |",
  "|---|---:|---:|---:|"
)
for (tool_name in TOOLS) {
  x <- primary[primary$tool == tool_name, ]
  report <- c(report, sprintf(
    "| %s | %.1f (%.1f-%.1f) | %.0f | %.1f |",
    TOOL_LABELS[tool_name], x$median_recall_percent,
    x$q1_recall_percent, x$q3_recall_percent,
    x$median_unique_citations, x$median_nnr
  ))
}
report <- c(
  report, "",
  sprintf(
    "Friedman chi-square(%d) = %.3f, p = %.6g; Kendall's W = %.3f.",
    f_primary$df, f_primary$friedman_chi_square,
    f_primary$p_value, f_primary$kendalls_w
  ),
  "",
  "## Original-estimand replication check",
  ""
)
for (tool_name in TOOLS) {
  x <- replication[replication$tool == tool_name, ]
  report <- c(report, sprintf(
    "- %s median recall: %.1f%%", TOOL_LABELS[tool_name], x$median_recall_percent
  ))
}
report <- c(
  report, "",
  "## Interpretation constraints",
  "",
  "- The archived outputs evaluate searches from six stratified seeds per review; they cannot answer how an all-studies-as-seeds search would perform.",
  "- Fuzzy title candidates are never counted automatically. One DOI-less target report was manually confirmed for four tools from concordant title, year, and author evidence; decisions are embedded in this script and exported in the adjudication audit.",
  sprintf("- The same record-level abstract-assessment method is applied to all three CiteChain modes; Combined contains abstracts for %d/%d records (%.1f%%). Citationchaser is assessed from record-level AB fields; PaperFetcher coverage is not calculable from its DOI-only output.", as.integer(total_corrected$best_abstract_total), as.integer(total_corrected$original_unique_records), as.numeric(total_corrected$best_pct_abstract_total)),
  "- Screening burden is unique retrieved citations minus true positives; NNR is unique retrieved citations divided by true positives."
)
writeLines(report, file.path(OUT, "RESULTS_BRIEF.md"), useBytes = TRUE)
cat(paste(report, collapse = "\n"), "\n")
