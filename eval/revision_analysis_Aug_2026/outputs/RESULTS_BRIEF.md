# Revised CiteChain evaluation: results brief

## Estimands

Primary: all eligible non-seed target reports, including non-DOI reports (573 targets overall).
Sensitivity analyses: expanded seed-inclusive; DOI-only seed-excluded; original DOI-only seed-inclusive estimand.

## Primary performance

| Tool | Median recall, % (IQR) | Median unique citations | Median NNR |
|---|---:|---:|---:|
| CiteChain (Combined) | 28.4 (14.9-35.6) | 542 | 52.8 |
| CiteChain (OpenAlex) | 27.4 (14.9-35.6) | 491 | 48.2 |
| CiteChain (Semantic Scholar) | 19.0 (9.0-22.0) | 288 | 51.9 |
| Citationchaser | 26.1 (14.9-34.6) | 461 | 47.5 |
| PaperFetcher | 21.5 (12.9-31.2) | 344 | 51.6 |

Friedman chi-square(4) = 27.485, p = 1.58563e-05; Kendall's W = 0.573.

## Original-estimand replication check

- CiteChain (Combined) median recall: 33.7%
- CiteChain (OpenAlex) median recall: 33.7%
- CiteChain (Semantic Scholar) median recall: 20.5%
- Citationchaser median recall: 31.5%
- PaperFetcher median recall: 28.2%

## Interpretation constraints

- The archived outputs evaluate searches from six stratified seeds per review; they cannot answer how an all-studies-as-seeds search would perform.
- Fuzzy title candidates are never counted automatically. One DOI-less target report was manually confirmed for four tools from concordant title, year, and author evidence; decisions are embedded in this script and exported in the adjudication audit.
- The same record-level abstract-assessment method is applied to all three CiteChain modes; Combined contains abstracts for 4711/7508 records (62.7%). Citationchaser is assessed from record-level AB fields; PaperFetcher coverage is not calculable from its DOI-only output.
- Screening burden is unique retrieved citations minus true positives; NNR is unique retrieved citations divided by true positives.
