suppressPackageStartupMessages(library(digest))

options(stringsAsFactors = FALSE, scipen = 999)

script_file <- sub("^--file=", "", grep("^--file=", commandArgs(trailingOnly = FALSE), value = TRUE)[1])
SCRIPT_DIR <- dirname(normalizePath(script_file, winslash = "/", mustWork = TRUE))
ORIGINAL <- file.path(SCRIPT_DIR, "inputs", "tool_results")
ABSTRACT_METADATA_DIR <- Sys.getenv(
  "CITECHAIN_ABSTRACT_METADATA_DIR",
  unset = file.path(SCRIPT_DIR, "inputs", "abstract_metadata")
)
OUT <- file.path(SCRIPT_DIR, "outputs")
dir.create(OUT, recursive = TRUE, showWarnings = FALSE)

EXPECTED_UNIQUE <- c(
  R01 = 571L, R02 = 618L, R03 = 313L, R04 = 1379L,
  R05 = 1178L, R06 = 545L, R07 = 392L, R08 = 597L,
  R09 = 539L, R10 = 427L, R11 = 549L, R12 = 400L
)

squish <- function(x) trimws(gsub("\\s+", " ", ifelse(is.na(x), "", as.character(x))))
standardize_doi <- function(x) {
  x <- tolower(squish(x))
  x <- sub("^(https?://)?(dx\\.)?doi\\.org/", "", x, perl = TRUE)
  x <- sub("^doi:", "", x, perl = TRUE)
  trimws(x)
}
normalize_title <- function(x) {
  x <- iconv(squish(x), from = "", to = "ASCII//TRANSLIT", sub = "")
  gsub("[^a-z0-9]", "", tolower(x), perl = TRUE)
}
split_ris <- function(path) {
  lines <- readLines(path, warn = FALSE, encoding = "UTF-8", skipNul = TRUE)
  ends <- which(startsWith(lines, "ER  -"))
  if (!length(ends)) return(list())
  starts <- c(1L, head(ends, -1L) + 1L)
  Map(function(a, b) lines[a:b], starts, ends)
}
tagged <- function(lines, tags) {
  prefixes <- paste0(tags, "  -")
  hits <- lines[vapply(lines, function(x) any(startsWith(x, prefixes)), logical(1))]
  if (!length(hits)) return(character())
  trimws(sub("^[A-Z0-9]{2}  -", "", hits))
}
field_with_continuations <- function(lines, tag) {
  prefix <- paste0(tag, "  -")
  i <- which(startsWith(lines, prefix))[1]
  if (is.na(i)) return("")
  values <- trimws(sub("^[A-Z0-9]{2}  -", "", lines[i]))
  if (i < length(lines)) {
    for (j in (i + 1L):length(lines)) {
      if (grepl("^[A-Z0-9]{2}  -", lines[j])) break
      if (nzchar(trimws(lines[j]))) values <- c(values, trimws(lines[j]))
    }
  }
  squish(paste(values, collapse = " "))
}
parse_ris <- function(path, direction, classify_abstract_source = FALSE, source_override = "") {
  records <- split_ris(path)
  if (!length(records)) {
    return(data.frame(
      doi = character(), title = character(), title_norm = character(),
      direction = character(), source_file = character(), source_position = integer(),
      category = character(), provider = character()
    ))
  }
  rows <- lapply(seq_along(records), function(i) {
    rec <- records[[i]]
    doi <- tagged(rec, "DO")
    title <- paste(tagged(rec, c("TI", "T1")), collapse = " ")
    category <- ""
    provider <- ""
    if (classify_abstract_source) {
      abstract <- field_with_continuations(rec, "AB")
      source_values <- tagged(rec, "DS")
      source <- tolower(squish(if (length(source_values)) source_values[1] else ""))
      provider_values <- tagged(rec, "DP")
      provider <- tolower(squish(if (length(provider_values)) provider_values[1] else ""))
      provider <- if (provider == "semantic scholar") "semantic_scholar" else provider
      has_abstract <- nzchar(abstract) && !tolower(abstract) %in% c("na", "n/a", "null", "none")
      category <- if (!has_abstract) {
        "no_abstract"
      } else if (source == "semantic scholar") {
        "semantic_scholar"
      } else if (source == "openalex") {
        "openalex"
      } else {
        "other_source"
      }
      if (nzchar(source_override) && category == "other_source") category <- source_override
    }
    data.frame(
      doi = standardize_doi(if (length(doi)) doi[1] else ""),
      title = squish(title),
      title_norm = normalize_title(title),
      direction = direction,
      source_file = basename(path),
      source_position = i,
      category = category,
      provider = provider
    )
  })
  do.call(rbind, rows)
}
best_category <- function(x) {
  for (candidate in c("semantic_scholar", "openalex", "other_source", "no_abstract")) {
    if (candidate %in% x) return(candidate)
  }
  "unresolved"
}
candidate_indices <- function(original, pool) {
  exact <- which(pool$doi == original$doi & pool$title == original$title)
  if (length(exact)) return(list(index = exact, method = "exact_doi_title"))
  if (nzchar(original$doi)) {
    doi_hits <- which(pool$doi == original$doi)
    if (length(doi_hits)) return(list(index = doi_hits, method = "doi"))
  }
  if (nzchar(original$title_norm)) {
    title_hits <- which(pool$title_norm == original$title_norm)
    if (length(title_hits)) {
      distinct_doi <- unique(pool$doi[title_hits][nzchar(pool$doi[title_hits])])
      distinct_title <- unique(pool$title[title_hits])
      if (length(distinct_doi) <= 1L && length(distinct_title) <= 2L) {
        return(list(index = title_hits, method = "unique_normalized_title"))
      }
      return(list(index = integer(), method = "ambiguous_normalized_title"))
    }
  }
  list(index = integer(), method = "unresolved")
}
write_csv <- function(x, name) {
  write.csv(x, file.path(OUT, name), row.names = FALSE, na = "", fileEncoding = "UTF-8")
}

prepare_original_set <- function(review, mode) {
  original_raw <- rbind(
    parse_ris(file.path(ORIGINAL, paste0(review, "_", mode, "_Forward.ris")), "Forward"),
    parse_ris(file.path(ORIGINAL, paste0(review, "_", mode, "_Backward.ris")), "Backward")
  )
  keys <- paste(original_raw$doi, original_raw$title, sep = "\r")
  first_rows <- which(!duplicated(keys))
  original <- original_raw[first_rows, , drop = FALSE]
  original$raw_occurrences <- as.integer(table(factor(keys, levels = keys[first_rows])))
  original$directions <- vapply(keys[first_rows], function(key) {
    paste(unique(original_raw$direction[keys == key]), collapse = ";")
  }, character(1))
  original
}

classify_original_set <- function(original, metadata_records, archived, review, mode) {
  classified <- lapply(seq_len(nrow(original)), function(i) {
    hit <- candidate_indices(original[i, ], metadata_records)
    source <- metadata_records
    method <- hit$method
    if (!length(hit$index) && method != "ambiguous_normalized_title") {
      fallback <- candidate_indices(original[i, ], archived)
      if (length(fallback$index)) {
        hit <- fallback
        source <- archived
        method <- paste0("archived_source_fallback_", fallback$method)
      }
    }
    categories <- if (length(hit$index)) source$category[hit$index] else character()
    distinct_categories <- sort(unique(categories))
    providers <- if (length(hit$index)) source$provider[hit$index] else character()
    distinct_providers <- sort(unique(providers[nzchar(providers)]))
    provider_classification <- if (!length(distinct_providers)) {
      "unresolved"
    } else if (length(distinct_providers) == 1L) {
      distinct_providers
    } else {
      "multiple"
    }
    data.frame(
      mode = mode,
      review = review,
      record_sequence = i,
      doi = original$doi[i],
      title = original$title[i],
      original_directions = original$directions[i],
      original_raw_occurrences = original$raw_occurrences[i],
      match_method = method,
      candidate_count = length(hit$index),
      candidate_categories = paste(distinct_categories, collapse = ";"),
      candidate_database_providers = paste(distinct_providers, collapse = ";"),
      classification_best_available = best_category(categories),
      classification_database_provider = provider_classification,
      classification_first_record = if (length(categories)) categories[1] else "unresolved",
      category_conflict = length(distinct_categories) > 1L,
      database_provider_conflict = length(distinct_providers) > 1L,
      candidate_files = if (length(hit$index)) {
        paste(paste0(source$source_file[hit$index], "#", source$source_position[hit$index]), collapse = ";")
      } else ""
    )
  })
  do.call(rbind, classified)
}

MODES <- c("CiteChain_Combined", "CiteChain_OpenAlex", "CiteChain_SemanticScholar")
all_mode_records <- list()
combined_records_by_review <- list()
metadata_categories <- character()
metadata_providers <- character()
for (review in names(EXPECTED_UNIQUE)) {
  metadata_records <- rbind(
    parse_ris(file.path(ABSTRACT_METADATA_DIR, paste0(review, "_For.ris")), "Forward", TRUE),
    parse_ris(file.path(ABSTRACT_METADATA_DIR, paste0(review, "_Back.ris")), "Backward", TRUE)
  )
  metadata_categories <- c(metadata_categories, metadata_records$category)
  metadata_providers <- c(metadata_providers, metadata_records$provider)
  archived <- rbind(
    parse_ris(file.path(ORIGINAL, paste0(review, "_CiteChain_SemanticScholar_Forward.ris")), "Forward", TRUE, "semantic_scholar"),
    parse_ris(file.path(ORIGINAL, paste0(review, "_CiteChain_SemanticScholar_Backward.ris")), "Backward", TRUE, "semantic_scholar"),
    parse_ris(file.path(ORIGINAL, paste0(review, "_CiteChain_OpenAlex_Forward.ris")), "Forward", TRUE, "openalex"),
    parse_ris(file.path(ORIGINAL, paste0(review, "_CiteChain_OpenAlex_Backward.ris")), "Backward", TRUE, "openalex")
  )
  for (mode in MODES) {
    original <- prepare_original_set(review, mode)
    if (mode == "CiteChain_Combined" && nrow(original) != EXPECTED_UNIQUE[[review]]) {
      stop(sprintf("%s reconstructed %d Combined records; expected %d", review, nrow(original), EXPECTED_UNIQUE[[review]]))
    }
    classified <- classify_original_set(original, metadata_records, archived, review, mode)
    all_mode_records[[paste(mode, review, sep = "|")]] <- classified
    if (mode == "CiteChain_Combined") combined_records_by_review[[review]] <- classified
  }
}

all_mode_record_data <- do.call(rbind, all_mode_records)
records <- do.call(rbind, combined_records_by_review)
if (nrow(records) != 7508L) stop("Original abstract denominator did not reproduce 7,508")
metadata_counts <- table(factor(metadata_categories, levels = c("semantic_scholar", "openalex", "no_abstract")))
if (!identical(as.integer(metadata_counts), c(1932L, 2883L, 3106L))) {
  stop(paste("Abstract-assessment input counts differ:", paste(names(metadata_counts), metadata_counts, collapse = "; ")))
}
metadata_provider_counts <- table(factor(metadata_providers, levels = c("semantic_scholar", "openalex")))
if (!identical(as.integer(metadata_provider_counts), c(5116L, 2805L))) {
  stop(paste("Database-provider counts differ:", paste(names(metadata_provider_counts), metadata_provider_counts, collapse = "; ")))
}

summarize_records <- function(x, review) {
  best <- table(factor(x$classification_best_available,
                       levels = c("semantic_scholar", "openalex", "other_source", "no_abstract", "unresolved")))
  first <- table(factor(x$classification_first_record,
                        levels = c("semantic_scholar", "openalex", "other_source", "no_abstract", "unresolved")))
  methods <- table(x$match_method)
  providers <- table(factor(
    x$classification_database_provider,
    levels = c("semantic_scholar", "openalex", "multiple", "unresolved")
  ))
  get_n <- function(name) if (name %in% names(methods)) unname(methods[[name]]) else 0L
  abstract_n <- best[["semantic_scholar"]] + best[["openalex"]] + best[["other_source"]]
  first_n <- first[["semantic_scholar"]] + first[["openalex"]] + first[["other_source"]]
  data.frame(
    review = review,
    original_unique_records = nrow(x),
    best_semantic_scholar = best[["semantic_scholar"]],
    best_openalex = best[["openalex"]],
    best_other_source = best[["other_source"]],
    best_no_abstract = best[["no_abstract"]],
    best_unresolved = best[["unresolved"]],
    provider_semantic_scholar = providers[["semantic_scholar"]],
    provider_openalex = providers[["openalex"]],
    provider_multiple = providers[["multiple"]],
    provider_unresolved = providers[["unresolved"]],
    best_abstract_total = abstract_n,
    best_pct_semantic_scholar = round(100 * best[["semantic_scholar"]] / nrow(x), 3),
    best_pct_openalex = round(100 * best[["openalex"]] / nrow(x), 3),
    best_pct_abstract_total = round(100 * abstract_n / nrow(x), 3),
    first_abstract_total = first_n,
    first_pct_abstract_total = round(100 * first_n / nrow(x), 3),
    exact_links = get_n("exact_doi_title"),
    doi_links = get_n("doi"),
    title_links = get_n("unique_normalized_title"),
    archived_fallback_links = sum(methods[startsWith(names(methods), "archived_source_fallback_")]),
    ambiguous_title_links = get_n("ambiguous_normalized_title"),
    unresolved_links = get_n("unresolved"),
    category_conflicts = sum(x$category_conflict),
    database_provider_conflicts = sum(x$database_provider_conflict)
  )
}
summary <- do.call(rbind, c(
  lapply(names(combined_records_by_review), function(review) summarize_records(combined_records_by_review[[review]], review)),
  list(summarize_records(records, "TOTAL"))
))
mode_summary <- do.call(rbind, lapply(MODES, function(mode) {
  x <- all_mode_record_data[all_mode_record_data$mode == mode, , drop = FALSE]
  best <- table(factor(
    x$classification_best_available,
    levels = c("semantic_scholar", "openalex", "other_source", "no_abstract", "unresolved")
  ))
  abstract_n <- best[["semantic_scholar"]] + best[["openalex"]] + best[["other_source"]]
  data.frame(
    tool = mode,
    denominator = nrow(x),
    semantic_scholar_abstracts = best[["semantic_scholar"]],
    openalex_abstracts = best[["openalex"]],
    other_source_abstracts = best[["other_source"]],
    no_abstract = best[["no_abstract"]],
    unresolved = best[["unresolved"]],
    records_with_abstract = abstract_n,
    abstract_coverage_percent = round(100 * abstract_n / nrow(x), 3)
  )
}))
audit <- records[
  records$match_method %in% c("unresolved", "ambiguous_normalized_title") |
    startsWith(records$match_method, "archived_source_fallback_") |
    records$category_conflict |
    records$database_provider_conflict |
    records$candidate_count > 2L,
]

source_provider_table <- as.data.frame.matrix(table(
  abstract_source = records$classification_best_available,
  database_provider = records$classification_database_provider
))
source_provider_table$abstract_source <- rownames(source_provider_table)
source_provider_table <- source_provider_table[, c("abstract_source", setdiff(names(source_provider_table), "abstract_source"))]
rownames(source_provider_table) <- NULL

write_csv(records, "abstract_record_classification.csv")
write_csv(all_mode_record_data, "citechain_mode_abstract_record_classification.csv")
write_csv(audit, "abstract_linkage_audit.csv")
write_csv(summary, "review_abstract_coverage_summary.csv")
write_csv(mode_summary, "citechain_mode_abstract_coverage_summary.csv")
write_csv(source_provider_table, "abstract_source_by_database_provider.csv")

abstract_input_paths <- unlist(lapply(names(EXPECTED_UNIQUE), function(review) {
  file.path(ABSTRACT_METADATA_DIR, c(paste0(review, "_For.ris"), paste0(review, "_Back.ris")))
}))
package_path <- function(x) {
  normalized <- normalizePath(x, winslash = "/", mustWork = TRUE)
  package_root <- paste0(normalizePath(SCRIPT_DIR, winslash = "/", mustWork = TRUE), "/")
  ifelse(startsWith(normalized, package_root), substring(normalized, nchar(package_root) + 1L), normalized)
}
abstract_input_manifest <- data.frame(
  path = package_path(abstract_input_paths),
  bytes = as.numeric(file.info(abstract_input_paths)$size),
  sha256 = vapply(abstract_input_paths, digest, character(1), algo = "sha256", file = TRUE)
)
write_csv(abstract_input_manifest, "abstract_input_manifest.csv")

total <- summary[summary$review == "TOTAL", ]
report <- c(
  "# Record-level abstract coverage", "",
  "- Scope: 7,508 unique CiteChain Combined citations.",
  "- Abstract availability was assessed at record level and linked to the corresponding retrieval records.",
  "- RIS `DS` records the abstract source; `DP` records the database provider. They are analysed as separate fields.", "",
  sprintf("- Semantic Scholar: %d/%d (%.1f%%).", total$best_semantic_scholar, total$original_unique_records, total$best_pct_semantic_scholar),
  sprintf("- OpenAlex fallback: %d/%d (%.1f%%).", total$best_openalex, total$original_unique_records, total$best_pct_openalex),
  sprintf("- Any abstract: %d/%d (%.1f%%).", total$best_abstract_total, total$original_unique_records, total$best_pct_abstract_total),
  sprintf("- No abstract: %d.", total$best_no_abstract),
  sprintf("- Unresolved linkage: %d.", total$best_unresolved), "",
  "The same record-level linkage and DS classification is applied separately to the original CiteChain OpenAlex and Semantic Scholar mode result sets; see `citechain_mode_abstract_coverage_summary.csv`.", "",
  "These are observed record-level linkage results, not proportions rescaled from a different record set."
)
writeLines(report, file.path(OUT, "ABSTRACT_COVERAGE.md"), useBytes = TRUE)
cat(paste(report, collapse = "\n"), "\n")
