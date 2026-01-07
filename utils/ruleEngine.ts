/**
 * Smart Rules Engine - Automatic bookmark/note organization
 * 
 * ALGORITHM: Pattern matching with optimized string operations
 * - URL pattern matching: O(n) where n = URL length
 * - Tag matching: O(1) via Set lookup
 * - Domain matching: O(1) via hostname extraction
 * 
 * RULE DSL:
 * {
 *   "condition": { "url": { "contains": "github.com" } },
 *   "action": { "addTag": "dev", "moveToFolder": "Code" }
 * }
 * 
 * EXECUTION MODEL:
 * - Rules stored in encrypted IndexedDB
 * - Evaluated on bookmark save
 * - Batch processing via Web Worker (future)
 * - Conflict resolution: First match wins (topological order)
 */

import { Bookmark, Note, Folder, Notebook } from '../types';

// Condition types
export interface UrlCondition {
    contains?: string;
    startsWith?: string;
    endsWith?: string;
    matches?: string; // Regex pattern
    domain?: string;  // Exact domain match
}

export interface TagCondition {
    hasTag?: string;
    hasAnyTag?: string[];
    hasAllTags?: string[];
    noTags?: boolean;
}

export interface ContentCondition {
    titleContains?: string;
    descriptionContains?: string;
}

export interface RuleCondition {
    url?: UrlCondition;
    tag?: TagCondition;
    content?: ContentCondition;
    and?: RuleCondition[];
    or?: RuleCondition[];
    not?: RuleCondition;
}

// Action types
export interface RuleAction {
    addTag?: string;
    addTags?: string[];
    removeTag?: string;
    removeTags?: string[];
    moveToFolder?: string;      // Folder ID or name
    moveToNotebook?: string;    // Notebook ID or name
    setDescription?: string;
    markFavorite?: boolean;
    archive?: boolean;
}

// Complete rule definition
export interface AutomationRule {
    id: string;
    name: string;
    description?: string;
    enabled: boolean;
    priority: number;           // Lower = higher priority
    condition: RuleCondition;
    action: RuleAction;
    createdAt: number;
    updatedAt: number;
    matchCount: number;         // How many times this rule matched
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
}

/**
 * Evaluate a URL condition
 */
function evaluateUrlCondition(url: string, condition: UrlCondition): boolean {
    const lowerUrl = url.toLowerCase();

    if (condition.contains && !lowerUrl.includes(condition.contains.toLowerCase())) {
        return false;
    }

    if (condition.startsWith && !lowerUrl.startsWith(condition.startsWith.toLowerCase())) {
        return false;
    }

    if (condition.endsWith && !lowerUrl.endsWith(condition.endsWith.toLowerCase())) {
        return false;
    }

    if (condition.domain) {
        const domain = extractDomain(url);
        if (domain !== condition.domain.toLowerCase()) {
            return false;
        }
    }

    if (condition.matches) {
        try {
            const regex = new RegExp(condition.matches, 'i');
            if (!regex.test(url)) {
                return false;
            }
        } catch {
            return false;
        }
    }

    return true;
}

/**
 * Evaluate a tag condition
 */
function evaluateTagCondition(tags: string[] | undefined, condition: TagCondition): boolean {
    const tagSet = new Set(tags || []);

    if (condition.hasTag && !tagSet.has(condition.hasTag)) {
        return false;
    }

    if (condition.hasAnyTag && !condition.hasAnyTag.some(t => tagSet.has(t))) {
        return false;
    }

    if (condition.hasAllTags && !condition.hasAllTags.every(t => tagSet.has(t))) {
        return false;
    }

    if (condition.noTags && tagSet.size > 0) {
        return false;
    }

    return true;
}

/**
 * Evaluate a content condition
 */
function evaluateContentCondition(
    title: string | undefined,
    description: string | undefined,
    condition: ContentCondition
): boolean {
    if (condition.titleContains) {
        if (!title?.toLowerCase().includes(condition.titleContains.toLowerCase())) {
            return false;
        }
    }

    if (condition.descriptionContains) {
        if (!description?.toLowerCase().includes(condition.descriptionContains.toLowerCase())) {
            return false;
        }
    }

    return true;
}

/**
 * Evaluate a complete rule condition
 */
export function evaluateCondition(
    item: Bookmark | Note,
    condition: RuleCondition
): boolean {
    // URL condition (bookmarks only)
    if (condition.url && 'url' in item) {
        if (!evaluateUrlCondition(item.url, condition.url)) {
            return false;
        }
    }

    // Tag condition
    if (condition.tag) {
        if (!evaluateTagCondition(item.tags, condition.tag)) {
            return false;
        }
    }

    // Content condition
    if (condition.content) {
        const description = 'description' in item ? item.description : undefined;
        if (!evaluateContentCondition(item.title, description, condition.content)) {
            return false;
        }
    }

    // AND: All sub-conditions must match
    if (condition.and && condition.and.length > 0) {
        if (!condition.and.every(sub => evaluateCondition(item, sub))) {
            return false;
        }
    }

    // OR: At least one sub-condition must match
    if (condition.or && condition.or.length > 0) {
        if (!condition.or.some(sub => evaluateCondition(item, sub))) {
            return false;
        }
    }

    // NOT: Sub-condition must NOT match
    if (condition.not) {
        if (evaluateCondition(item, condition.not)) {
            return false;
        }
    }

    return true;
}

/**
 * Apply an action to a bookmark
 */
export function applyActionToBookmark(
    bookmark: Bookmark,
    action: RuleAction,
    folders: Folder[]
): Bookmark {
    let modified = { ...bookmark };
    let tags = new Set(modified.tags || []);

    // Add tags
    if (action.addTag) {
        tags.add(action.addTag);
    }
    if (action.addTags) {
        action.addTags.forEach(t => tags.add(t));
    }

    // Remove tags
    if (action.removeTag) {
        tags.delete(action.removeTag);
    }
    if (action.removeTags) {
        action.removeTags.forEach(t => tags.delete(t));
    }

    modified.tags = Array.from(tags);

    // Move to folder
    if (action.moveToFolder) {
        // Find folder by name or ID
        const folder = folders.find(
            f => f.id === action.moveToFolder || f.name === action.moveToFolder
        );
        if (folder) {
            modified.folderId = folder.id;
        }
    }

    // Set description
    if (action.setDescription) {
        modified.description = action.setDescription;
    }

    return modified;
}

/**
 * Apply an action to a note
 */
export function applyActionToNote(
    note: Note,
    action: RuleAction,
    notebooks: Notebook[]
): Note {
    let modified = { ...note };
    let tags = new Set(modified.tags || []);

    // Add tags
    if (action.addTag) {
        tags.add(action.addTag);
    }
    if (action.addTags) {
        action.addTags.forEach(t => tags.add(t));
    }

    // Remove tags
    if (action.removeTag) {
        tags.delete(action.removeTag);
    }
    if (action.removeTags) {
        action.removeTags.forEach(t => tags.delete(t));
    }

    modified.tags = Array.from(tags);

    // Move to notebook
    if (action.moveToNotebook) {
        const notebook = notebooks.find(
            n => n.id === action.moveToNotebook || n.name === action.moveToNotebook
        );
        if (notebook) {
            modified.notebookId = notebook.id;
        }
    }

    return modified;
}

/**
 * Run all enabled rules against a bookmark
 * Returns the modified bookmark and list of matched rule IDs
 */
export function processBookmarkWithRules(
    bookmark: Bookmark,
    rules: AutomationRule[],
    folders: Folder[]
): { result: Bookmark; matchedRules: string[] } {
    // Sort by priority (lower = higher priority)
    const sortedRules = [...rules]
        .filter(r => r.enabled)
        .sort((a, b) => a.priority - b.priority);

    let result = { ...bookmark };
    const matchedRules: string[] = [];

    for (const rule of sortedRules) {
        if (evaluateCondition(result, rule.condition)) {
            result = applyActionToBookmark(result, rule.action, folders);
            matchedRules.push(rule.id);
        }
    }

    return { result, matchedRules };
}

/**
 * Run all enabled rules against a note
 */
export function processNoteWithRules(
    note: Note,
    rules: AutomationRule[],
    notebooks: Notebook[]
): { result: Note; matchedRules: string[] } {
    const sortedRules = [...rules]
        .filter(r => r.enabled)
        .sort((a, b) => a.priority - b.priority);

    let result = { ...note };
    const matchedRules: string[] = [];

    for (const rule of sortedRules) {
        if (evaluateCondition(result, rule.condition)) {
            result = applyActionToNote(result, rule.action, notebooks);
            matchedRules.push(rule.id);
        }
    }

    return { result, matchedRules };
}

/**
 * Create a new rule with defaults
 */
export function createRule(
    name: string,
    condition: RuleCondition,
    action: RuleAction
): AutomationRule {
    return {
        id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        enabled: true,
        priority: 100,
        condition,
        action,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        matchCount: 0,
    };
}

/**
 * Preset rules for common use cases
 */
export const PRESET_RULES: Partial<AutomationRule>[] = [
    {
        name: 'Tag GitHub repos as "dev"',
        condition: { url: { domain: 'github.com' } },
        action: { addTag: 'dev' },
    },
    {
        name: 'Tag YouTube as "video"',
        condition: { url: { domain: 'youtube.com' } },
        action: { addTag: 'video' },
    },
    {
        name: 'Tag Twitter/X as "social"',
        condition: {
            or: [
                { url: { domain: 'twitter.com' } },
                { url: { domain: 'x.com' } }
            ]
        },
        action: { addTag: 'social' },
    },
    {
        name: 'Tag academic papers',
        condition: {
            or: [
                { url: { contains: 'doi.org' } },
                { url: { contains: 'arxiv.org' } },
                { url: { contains: 'pubmed' } },
            ]
        },
        action: { addTag: 'research' },
    },
    {
        name: 'Tag documentation',
        condition: {
            or: [
                { url: { contains: '/docs/' } },
                { url: { contains: 'documentation' } },
                { content: { titleContains: 'docs' } },
            ]
        },
        action: { addTag: 'docs' },
    },
];
