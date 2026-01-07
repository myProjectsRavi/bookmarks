/**
 * Citation Parser - Detect and extract academic paper metadata
 * 
 * SUPPORTED PATTERNS:
 * - DOI: 10.xxxx/xxxxx (CrossRef API)
 * - arXiv: arxiv.org/abs/xxxx.xxxxx
 * - PubMed: pubmed.ncbi.nlm.nih.gov/xxxxx
 * - Semantic Scholar: semanticscholar.org/paper/xxxx
 * 
 * COMPLEXITY:
 * - Pattern detection: O(1) regex
 * - Metadata fetch: O(1) API call
 * 
 * ZERO COST: All APIs used are free with generous rate limits
 */

export interface AcademicMetadata {
    type: 'doi' | 'arxiv' | 'pubmed' | 'unknown';
    id: string;
    title?: string;
    authors?: string[];
    year?: number;
    journal?: string;
    volume?: string;
    issue?: string;
    pages?: string;
    doi?: string;
    url?: string;
    abstract?: string;
    citationCount?: number;
}

// Regex patterns for academic identifiers
const PATTERNS = {
    // DOI: 10.xxxx/xxxxx (anywhere in URL or text)
    DOI: /\b(10\.\d{4,}(?:\.\d+)*\/(?:(?!["&'<>])\S)+)\b/i,

    // arXiv: arxiv.org/abs/xxxx.xxxxx or arXiv:xxxx.xxxxx
    ARXIV: /(?:arxiv\.org\/abs\/|arXiv:)(\d{4}\.\d{4,5}(?:v\d+)?)/i,

    // PubMed: pubmed.ncbi.nlm.nih.gov/xxxxx
    PUBMED: /pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i,

    // Semantic Scholar paper ID
    SEMANTIC: /semanticscholar\.org\/paper\/[^/]+\/([a-f0-9]{40})/i,
};

/**
 * Detect if a URL contains academic paper references
 */
export function detectAcademicUrl(url: string): { type: AcademicMetadata['type']; id: string } | null {
    // Check DOI
    const doiMatch = url.match(PATTERNS.DOI);
    if (doiMatch) {
        return { type: 'doi', id: doiMatch[1] };
    }

    // Check arXiv
    const arxivMatch = url.match(PATTERNS.ARXIV);
    if (arxivMatch) {
        return { type: 'arxiv', id: arxivMatch[1] };
    }

    // Check PubMed
    const pubmedMatch = url.match(PATTERNS.PUBMED);
    if (pubmedMatch) {
        return { type: 'pubmed', id: pubmedMatch[1] };
    }

    return null;
}

/**
 * Fetch metadata from CrossRef API (free, 50 req/sec)
 */
async function fetchFromCrossRef(doi: string): Promise<AcademicMetadata | null> {
    try {
        const response = await fetch(
            `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
            {
                headers: {
                    'Accept': 'application/json',
                    // Polite pool for better rate limits
                    'User-Agent': 'LinkHaven/1.0 (mailto:contact@linkhaven.app)'
                }
            }
        );

        if (!response.ok) return null;

        const data = await response.json();
        const work = data.message;

        return {
            type: 'doi',
            id: doi,
            doi: doi,
            title: work.title?.[0] || '',
            authors: work.author?.map((a: any) =>
                `${a.given || ''} ${a.family || ''}`.trim()
            ) || [],
            year: work.published?.['date-parts']?.[0]?.[0] ||
                work.created?.['date-parts']?.[0]?.[0],
            journal: work['container-title']?.[0] || '',
            volume: work.volume,
            issue: work.issue,
            pages: work.page,
            url: work.URL || `https://doi.org/${doi}`,
        };
    } catch (e) {
        console.error('CrossRef fetch failed:', e);
        return null;
    }
}

/**
 * Fetch metadata from Semantic Scholar API (free, 100 req/sec)
 */
async function fetchFromSemanticScholar(arxivId: string): Promise<AcademicMetadata | null> {
    try {
        const response = await fetch(
            `https://api.semanticscholar.org/graph/v1/paper/arXiv:${arxivId}?fields=title,authors,year,abstract,citationCount,externalIds`,
            { headers: { 'Accept': 'application/json' } }
        );

        if (!response.ok) return null;

        const data = await response.json();

        return {
            type: 'arxiv',
            id: arxivId,
            title: data.title || '',
            authors: data.authors?.map((a: any) => a.name) || [],
            year: data.year,
            abstract: data.abstract,
            citationCount: data.citationCount,
            doi: data.externalIds?.DOI,
            url: `https://arxiv.org/abs/${arxivId}`,
        };
    } catch (e) {
        console.error('Semantic Scholar fetch failed:', e);
        return null;
    }
}

/**
 * Fetch academic metadata for any supported URL
 */
export async function fetchAcademicMetadata(url: string): Promise<AcademicMetadata | null> {
    const detected = detectAcademicUrl(url);
    if (!detected) return null;

    switch (detected.type) {
        case 'doi':
            return fetchFromCrossRef(detected.id);
        case 'arxiv':
            return fetchFromSemanticScholar(detected.id);
        default:
            return null;
    }
}

/**
 * Check if a URL is likely an academic paper
 */
export function isAcademicUrl(url: string): boolean {
    return detectAcademicUrl(url) !== null ||
        url.includes('scholar.google') ||
        url.includes('researchgate.net') ||
        url.includes('jstor.org') ||
        url.includes('ieee.org') ||
        url.includes('acm.org') ||
        url.includes('springer.com') ||
        url.includes('sciencedirect.com') ||
        url.includes('nature.com') ||
        url.includes('science.org');
}
