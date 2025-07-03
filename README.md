# CiteChain - Automated Citation Searching

[![Next.js](https://img.shields.io/badge/Next.js-15.3.4-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38bdf8)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-GPL--3.0-green.svg)](LICENSE)

CiteChain is a comprehensive web application for automated citation searching, designed to support systematic literature reviews by identifying backward citations (references) and forward citations (citing papers) from seed articles. The application integrates multiple academic databases (OpenAlex and Semantic Scholar) to provide comprehensive citation coverage with advanced deduplication and enrichment capabilities.

## ✨ Features

### 🔍 **Multi-Source Citation Search**

- **OpenAlex Integration**
- **Semantic Scholar Integration**
- **Smart Fallback System**: Automatic fallback between APIs for maximum coverage

### 📚 **Flexible Input Methods**

- **File Upload Support**: RIS, NBIB (PubMed), and EndNote XML formats
- **Identifier Entry**: DOI, PMID, and PMCID support
- **Batch Processing**: Handle up to 100 seed references simultaneously
- **Real-time Validation**: Immediate feedback on reference quality and coverage

### 🔄 **Bidirectional Citation Searching**

- **Backward Citations**: Find references cited by your seed references
- **Forward Citations**: Discover papers that cite your seed references
- **Combined Results**: Unified view with intelligent deduplication

### 🎯 **Advanced Processing**

- **Smart Deduplication**: Remove duplicates using hierarchical identifier matching (DOI → PMID → PMCID → OpenAlex → MAG → Title)
- **Abstract Enrichment**: Automatically enrich OpenAlex citations with abstracts from Semantic Scholar
- **Batch Optimization**: Efficient API usage with configurable batch sizes
- **Rate Limiting**: Built-in rate limiting to respect API constraints

### 📊 **Comprehensive Results**

- **Detailed Statistics**: Deduplication metrics, and source breakdowns
- **Interactive Tables**: Citation tables with rich metadata
- **Export Capabilities**: Download results in RIS format for reference managers
- **Real-time Progress**: Live updates during processing with detailed server logging

### 💾 **Persistent State Management**

- **IndexedDB Storage**: Client-side persistence using IndexedDB for large datasets
- **Session Recovery**: Resume work after browser restarts
- **Data Integrity**: Robust error handling and data validation

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+
- **pnpm** 9.15.0+ (recommended package manager)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/AliAzlanDev/citechain-new.git
   cd citechain-new
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Start the development server**

   ```bash
   pnpm dev
   ```

4. **Open in browser**

   Navigate to [http://localhost:3000](http://localhost:3000) to start using CiteChain.

### Production Build

```bash
# Build for production
pnpm build

# Start production server
pnpm start
```

## 📖 How to Use

### Step 1: Import Seed References

Choose one or more methods to provide seed references:

#### File Upload

- Drag and drop or select files in supported formats:
  - **RIS files** (.ris) - Most reference managers
  - **NBIB files** (.nbib) - PubMed format
  - **EndNote XML** (.xml) - EndNote exports

#### Manual Entry

- Enter identifiers directly:
  - **DOI**: `10.1234/example.doi`
  - **PMID**: `12345678`
  - **PMCID**: `PMC1234567`

The system automatically validates and resolves metadata for each reference.

### Step 2: Configure Citation Search

#### Select Provider

- **OpenAlex**: Has over 250 million scholarly works
- **Semantic Scholar**: Has over 200 million papers with rich metadata
- **Both**: Both providers followed by deduplication

#### Choose Search Direction

- **Backward**: Find references cited by your seed references
- **Forward**: Find papers that cite your seed references
- **Both**: Complete bidirectional search

### Step 3: Download and Analyze Results

- **View Results**: Interactive tables
- **Download Citations**: Export in RIS format for reference managers
- **Analyze Statistics**: Deduplication metrics

## 🏗️ Project Structure

```
citechain-new/
├── app/                          # Next.js app directory
│   ├── api/                      # API routes
│   │   ├── search-citations/     # Citation search endpoint
│   │   └── validate-seed-references/ # Reference validation endpoint
│   ├── globals.css               # Global styles
│   ├── layout.tsx               # Root layout component
│   └── page.tsx                 # Main application page
├── components/                   # React components
│   ├── step-1/                  # Seed reference import components
│   ├── step-2/                  # Citation search configuration
│   ├── step-3/                  # Results display and download
│   └── ui/                      # Reusable UI components
├── lib/                         # Core libraries and utilities
│   ├── citations/               # Citation search module
│   │   ├── index.ts            # Main citation search API
│   │   ├── processors.ts       # Processing logic
│   │   ├── services.ts         # API service functions
│   │   ├── types.ts            # Type definitions
│   │   └── README.md           # Module documentation
│   ├── validation/              # Reference validation module
│   │   ├── index.ts            # Main validation API
│   │   ├── processors.ts       # Validation logic
│   │   ├── services.ts         # API service functions
│   │   ├── types.ts            # Type definitions
│   │   └── README.md           # Module documentation
│   ├── error.ts                # Error handling utilities
│   ├── generate-ris.ts         # RIS format generation
│   ├── openalex.ts             # OpenAlex API integration
│   ├── parse.ts                # File parsing utilities
│   ├── s2.ts                   # Semantic Scholar API integration
│   ├── store.ts                # Zustand state management
│   ├── types.ts                # Global type definitions
│   ├── use-citation-search.ts  # Citation search hook
│   └── utils.ts                # Utility functions
├── package.json                # Dependencies and scripts
├── next.config.ts              # Next.js configuration
├── tsconfig.json               # TypeScript configuration
└── README.md                   # This file
```

## 🔧 Technology Stack

### Frontend

- **Next.js 15.3.4**: React framework with App Router
- **React 19**: Latest React with concurrent features
- **TypeScript 5**: Full type safety
- **Tailwind CSS 4**: Utility-first CSS framework
- **Radix UI**: Accessible component primitives
- **Motion**: Smooth animations and transitions

### State Management

- **Zustand**: Lightweight state management
- **IndexedDB**: Client-side persistent storage via `idb-keyval`

### Data Processing

- **Zod**: Runtime type validation
- **BibLib**: Bibliography file parsing
- **Nanoid**: Unique ID generation

### API Integration

- **Bottleneck**: Rate limiting for API calls
- **Built-in Fetch**: HTTP client with timeout handling

### Development Tools

- **ESLint**: Code linting
- **PostCSS**: CSS processing
- **pnpm**: Fast, disk space efficient package manager

## 🏛️ Core Modules

### Citation Search Module (`lib/citations/`)

Handles the core citation searching functionality with support for:

- Multiple API providers (OpenAlex, Semantic Scholar)
- Bidirectional searching (backward/forward citations)
- Advanced deduplication strategies
- Abstract enrichment from multiple sources
- Comprehensive error handling and logging

[📚 Full Documentation](lib/citations/README.md)

### Validation Module (`lib/validation/`)

Manages seed reference validation and metadata resolution:

- Multi-identifier support (DOI, PMID, PMCID, OpenAlex, MAG)
- Smart fallback strategies between APIs
- Title-based search as last resort
- Duplicate detection and statistics
- Optimized batch processing

[📚 Full Documentation](lib/validation/README.md)

## 📊 API Reference

### Citation Search API

**POST** `/api/search-citations`

Search for backward and forward citations using validated seed references.

```typescript
// Request
{
  "inputs": [
    {
      "id": "string",
      "openalex_id": "string?",
      "s2_id": "string?",
      "doi": "string?",
      "pmid": "string?",
      "title": "string?"
    }
  ],
  "options": {
    "provider": "openalex" | "semantic_scholar" | "both",
    "direction": "backward" | "forward" | "both"
  }
}

// Response
{
  "success": true,
  "data": {
    "backward": Citation[],
    "forward": Citation[],
    "combined": Citation[],
    "deduplication": {
      "backwardProviderOverlap": number,
      "forwardProviderOverlap": number,
      "directionOverlap": number
    },
    "statistics": {
      "totalBackward": number,
      "totalForward": number,
      "totalCombined": number,
      "sources": {
        "openalex": { "backward": number, "forward": number },
        "semanticScholar": { "backward": number, "forward": number }
      }
    }
  }
}
```

### Reference Validation API

**POST** `/api/validate-seed-references`

Validate and resolve metadata for seed references.

```typescript
// Request
{
  "references": [
    {
      "id": "string",
      "title": "string?",
      "doi": "string?",
      "pmid": "string?",
      "pmcid": "string?",
      "openalex": "string?",
      "mag": "string?"
    }
  ]
}

// Response
{
  "results": [
    {
      "id": "string",
      "found": boolean,
      "searched_by_title": boolean,
      "data": {
        "title": "string",
        "doi": "string?",
        "journal": "string?",
        "openalex_id": "string?",
        "s2_id": "string?",
        "year": number
      } | null
    }
  ],
  "deduplication": {
    "doi": number,
    "pmid": number,
    // ... other identifier types
  }
}
```

## 🎯 Performance & Limitations

### Performance Characteristics

- **API Efficiency**: Optimized batch sizes reduce API calls
- **Processing Speed**: Parallel processing and smart fallbacks minimize total time
- **Memory Usage**: Map-based processing handles references efficiently

### Current Limitations

- **Seed Reference Limit**: Maximum 100 seed references per session
- **API Rate Limits** (enough for most use cases):
  - OpenAlex: 10 requests/second
  - Semantic Scholar: 1 request/second

### Optimization Tips

- Use DOIs when available for best success rates
- Process references in smaller batches for faster feedback
- Prefer both providers for maximum coverage

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit changes**: `git commit -m 'Add amazing feature'`
4. **Push to branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Development Guidelines

- Follow TypeScript best practices
- Add tests for new functionality
- Update documentation for API changes
- Ensure accessibility compliance
- Test across different browsers

## 📄 License

This project is licensed under the GNU General Public License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- **[Ali Azlan](https://aliazlan.me)** - _Lead Developer_ - [@AliAzlanReal](https://twitter.com/AliAzlanReal)
- **Wajeeha Fatima Tareen** - _Research Contributor_
- **Abdul Wahab Mirza** - _Research Contributor_
- **Abraiz Ahmad** - _Research Contributor_
- **Zoha Rafaqat** - _Research Contributor_
- **Sophia Ahmed** - _Research Contributor_

## 🙏 Acknowledgments

- **OpenAlex** for providing open access to scholarly metadata
- **Semantic Scholar** for enriching citations with abstracts and additional metadata
- **BibLib** for robust bibliography file parsing
- **Next.js** team for the excellent framework
- **Vercel** for deployment platform

## 📧 Support

For support, questions, or feature requests:

- **Email**: aliazlanreal@gmail.com
- **Website**: [citechain.aliazlan.me](https://citechain.aliazlan.me)
- **Issues**: [GitHub Issues](https://github.com/AliAzlanDev/citechain-new/issues)

---

<div align="center">
  <p><strong>CiteChain</strong> - Making systematic literature reviews more efficient</p>
  <p>Developed with ❤️ by <a href="https://aliazlan.me">Ali Azlan</a></p>
</div>
