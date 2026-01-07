/**
 * Citation Formatter - Generate citations in multiple formats
 * 
 * SUPPORTED FORMATS:
 * - APA 7th Edition
 * - MLA 9th Edition
 * - Chicago 17th Edition
 * - Harvard
 * - IEEE
 * - BibTeX
 * - RIS (EndNote/Zotero import)
 * 
 * MATH MOAT: Pure template-based formatting, no external service
 * COMPLEXITY: O(1) per citation
 */

import { AcademicMetadata } from './citationParser';

export type CitationFormat =
    | 'apa'
    | 'mla'
    | 'chicago'
    | 'harvard'
    | 'ieee'
    | 'bibtex'
    | 'ris';

/**
 * Format author names for different citation styles
 */
function formatAuthors(
    authors: string[] | undefined,
    style: CitationFormat,
    maxAuthors: number = 20
): string {
    if (!authors || authors.length === 0) return 'Unknown Author';

    const truncated = authors.length > maxAuthors;
    const displayAuthors = truncated ? authors.slice(0, maxAuthors) : authors;

    switch (style) {
        case 'apa':
            // Last, F. M., Last, F. M., & Last, F. M.
            return displayAuthors.map((name, i) => {
                const parts = name.split(' ');
                const lastName = parts.pop() || '';
                const initials = parts.map(p => p[0] + '.').join(' ');
                const formatted = `${lastName}, ${initials}`;

                if (i === displayAuthors.length - 1 && displayAuthors.length > 1) {
                    return `& ${formatted}`;
                }
                return formatted;
            }).join(', ') + (truncated ? ', et al.' : '');

        case 'mla':
            // Last, First, et al.
            if (authors.length === 1) {
                const parts = authors[0].split(' ');
                const lastName = parts.pop() || '';
                return `${lastName}, ${parts.join(' ')}`;
            }
            const first = authors[0].split(' ');
            const lastName = first.pop() || '';
            return `${lastName}, ${first.join(' ')}, et al.`;

        case 'chicago':
            // Same as APA
            return formatAuthors(authors, 'apa', maxAuthors);

        case 'harvard':
            // Last, F.M., Last, F.M. and Last, F.M.
            return displayAuthors.map((name, i) => {
                const parts = name.split(' ');
                const lastName = parts.pop() || '';
                const initials = parts.map(p => p[0] + '.').join('');
                const formatted = `${lastName}, ${initials}`;

                if (i === displayAuthors.length - 1 && displayAuthors.length > 1) {
                    return `and ${formatted}`;
                }
                return formatted;
            }).join(', ') + (truncated ? ' et al.' : '');

        case 'ieee':
            // F. M. Last, F. M. Last, and F. M. Last
            return displayAuthors.map((name, i) => {
                const parts = name.split(' ');
                const lastName = parts.pop() || '';
                const initials = parts.map(p => p[0] + '.').join(' ');
                const formatted = `${initials} ${lastName}`;

                if (i === displayAuthors.length - 1 && displayAuthors.length > 1) {
                    return `and ${formatted}`;
                }
                return formatted;
            }).join(', ') + (truncated ? ', et al.' : '');

        case 'bibtex':
            // Last, First and Last, First
            return authors.map(name => {
                const parts = name.split(' ');
                const lastName = parts.pop() || '';
                return `${lastName}, ${parts.join(' ')}`;
            }).join(' and ');

        case 'ris':
            // Each author on separate AU line
            return authors.map(name => {
                const parts = name.split(' ');
                const lastName = parts.pop() || '';
                return `${lastName}, ${parts.join(' ')}`;
            }).join('\n');

        default:
            return authors.join(', ');
    }
}

/**
 * Generate a BibTeX key from author and year
 */
function generateBibKey(authors: string[] | undefined, year: number | undefined): string {
    const authorKey = authors?.[0]?.split(' ').pop()?.toLowerCase() || 'unknown';
    const yearKey = year?.toString() || 'nd';
    return `${authorKey}${yearKey}`;
}

/**
 * Format a citation in the specified style
 */
export function formatCitation(
    metadata: AcademicMetadata,
    format: CitationFormat
): string {
    const { title, authors, year, journal, volume, issue, pages, doi, url } = metadata;

    switch (format) {
        case 'apa':
            // Author, A. A., & Author, B. B. (Year). Title. Journal, Volume(Issue), Pages. DOI
            return `${formatAuthors(authors, 'apa')} (${year || 'n.d.'}). ${title || 'Untitled'}. ` +
                `${journal ? `*${journal}*` : ''}${volume ? `, *${volume}*` : ''}` +
                `${issue ? `(${issue})` : ''}${pages ? `, ${pages}` : ''}. ` +
                `${doi ? `https://doi.org/${doi}` : url || ''}`;

        case 'mla':
            // Author. "Title." Journal, vol. X, no. X, Year, pp. X-X.
            return `${formatAuthors(authors, 'mla')}. "${title || 'Untitled'}." ` +
                `*${journal || 'Unknown Journal'}*` +
                `${volume ? `, vol. ${volume}` : ''}${issue ? `, no. ${issue}` : ''}` +
                `${year ? `, ${year}` : ''}${pages ? `, pp. ${pages}` : ''}.`;

        case 'chicago':
            // Author. "Title." Journal Volume, no. Issue (Year): Pages. DOI.
            return `${formatAuthors(authors, 'chicago')}. "${title || 'Untitled'}." ` +
                `*${journal || ''}* ${volume || ''}` +
                `${issue ? `, no. ${issue}` : ''} (${year || 'n.d.'})` +
                `${pages ? `: ${pages}` : ''}. ${doi ? `https://doi.org/${doi}` : ''}`;

        case 'harvard':
            // Author (Year) 'Title', Journal, Volume(Issue), pp. Pages.
            return `${formatAuthors(authors, 'harvard')} (${year || 'n.d.'}) ` +
                `'${title || 'Untitled'}', *${journal || ''}*` +
                `${volume ? `, ${volume}` : ''}${issue ? `(${issue})` : ''}` +
                `${pages ? `, pp. ${pages}` : ''}.`;

        case 'ieee':
            // [1] F. M. Last et al., "Title," Journal, vol. X, no. X, pp. X-X, Year.
            return `${formatAuthors(authors, 'ieee')}, "${title || 'Untitled'}," ` +
                `*${journal || ''}*${volume ? `, vol. ${volume}` : ''}` +
                `${issue ? `, no. ${issue}` : ''}${pages ? `, pp. ${pages}` : ''}` +
                `, ${year || 'n.d.'}.`;

        case 'bibtex':
            const key = generateBibKey(authors, year);
            return `@article{${key},
  author = {${formatAuthors(authors, 'bibtex')}},
  title = {${title || 'Untitled'}},
  journal = {${journal || ''}},
  year = {${year || ''}},
  volume = {${volume || ''}},
  number = {${issue || ''}},
  pages = {${pages || ''}},
  doi = {${doi || ''}}
}`;

        case 'ris':
            return `TY  - JOUR
${authors?.map(a => `AU  - ${a}`).join('\n') || 'AU  - Unknown'}
TI  - ${title || 'Untitled'}
JO  - ${journal || ''}
VL  - ${volume || ''}
IS  - ${issue || ''}
SP  - ${pages?.split('-')[0] || ''}
EP  - ${pages?.split('-')[1] || ''}
PY  - ${year || ''}
DO  - ${doi || ''}
ER  - `;

        default:
            return `${authors?.join(', ')} (${year}). ${title}. ${journal}.`;
    }
}

/**
 * Get human-readable format name
 */
export function getFormatName(format: CitationFormat): string {
    const names: Record<CitationFormat, string> = {
        apa: 'APA 7th Edition',
        mla: 'MLA 9th Edition',
        chicago: 'Chicago 17th',
        harvard: 'Harvard',
        ieee: 'IEEE',
        bibtex: 'BibTeX',
        ris: 'RIS (EndNote/Zotero)',
    };
    return names[format];
}

/**
 * Get all available citation formats
 */
export function getAvailableFormats(): CitationFormat[] {
    return ['apa', 'mla', 'chicago', 'harvard', 'ieee', 'bibtex', 'ris'];
}

/**
 * Generate bibliography from multiple citations
 */
export function generateBibliography(
    items: AcademicMetadata[],
    format: CitationFormat
): string {
    if (format === 'bibtex') {
        return items.map(item => formatCitation(item, 'bibtex')).join('\n\n');
    }

    if (format === 'ris') {
        return items.map(item => formatCitation(item, 'ris')).join('\n');
    }

    // Numbered list for other formats
    return items
        .map((item, i) => `[${i + 1}] ${formatCitation(item, format)}`)
        .join('\n\n');
}
