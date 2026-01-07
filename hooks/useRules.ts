/**
 * useRules - Smart Rules Engine Hook
 * 
 * Provides rule management and automatic processing for bookmarks/notes.
 * Rules are stored in encrypted IndexedDB alongside other app data.
 */

import { useState, useCallback, useEffect } from 'react';
import { openDB, IDBPDatabase, DBSchema } from 'idb';
import { Bookmark, Note, Folder, Notebook } from '../types';
import {
    AutomationRule,
    RuleCondition,
    RuleAction,
    createRule,
    processBookmarkWithRules,
    processNoteWithRules,
    PRESET_RULES,
} from '../utils/ruleEngine';
import { encrypt, decrypt } from '../utils/crypto';

const RULES_DB_NAME = 'LinkHavenRules';
const RULES_DB_VERSION = 1;

interface RulesDB extends DBSchema {
    rules: {
        key: string;
        value: AutomationRule;
        indexes: { 'by-priority': number };
    };
}

let rulesDbPromise: Promise<IDBPDatabase<RulesDB>> | null = null;

function getRulesDB(): Promise<IDBPDatabase<RulesDB>> {
    if (!rulesDbPromise) {
        rulesDbPromise = openDB<RulesDB>(RULES_DB_NAME, RULES_DB_VERSION, {
            upgrade(db) {
                const store = db.createObjectStore('rules', { keyPath: 'id' });
                store.createIndex('by-priority', 'priority');
            },
        });
    }
    return rulesDbPromise;
}

export function useRules(cryptoKey: CryptoKey | null) {
    const [rules, setRules] = useState<AutomationRule[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Load rules from IndexedDB
    const loadRules = useCallback(async () => {
        try {
            const db = await getRulesDB();
            const allRules = await db.getAll('rules');

            // Decrypt if needed
            const decrypted = cryptoKey
                ? await Promise.all(allRules.map(async (r: any) => {
                    if (r._encrypted) {
                        const data = await decrypt(r._encrypted, cryptoKey);
                        return JSON.parse(data);
                    }
                    return r;
                }))
                : allRules;

            setRules(decrypted.sort((a, b) => a.priority - b.priority));
            setIsLoading(false);
        } catch (e) {
            console.error('Failed to load rules:', e);
            setIsLoading(false);
        }
    }, [cryptoKey]);

    useEffect(() => {
        if (cryptoKey) loadRules();
    }, [cryptoKey, loadRules]);

    // Save a rule
    const saveRule = useCallback(async (rule: AutomationRule) => {
        try {
            const db = await getRulesDB();

            if (cryptoKey) {
                const encrypted = await encrypt(JSON.stringify(rule), cryptoKey);
                await db.put('rules', { id: rule.id, _encrypted: encrypted } as any);
            } else {
                await db.put('rules', rule);
            }

            await loadRules();
        } catch (e) {
            console.error('Failed to save rule:', e);
        }
    }, [cryptoKey, loadRules]);

    // Delete a rule
    const deleteRule = useCallback(async (ruleId: string) => {
        try {
            const db = await getRulesDB();
            await db.delete('rules', ruleId);
            await loadRules();
        } catch (e) {
            console.error('Failed to delete rule:', e);
        }
    }, [loadRules]);

    // Add a new rule
    const addRule = useCallback(async (
        name: string,
        condition: RuleCondition,
        action: RuleAction
    ) => {
        const rule = createRule(name, condition, action);
        await saveRule(rule);
        return rule;
    }, [saveRule]);

    // Toggle rule enabled/disabled
    const toggleRule = useCallback(async (ruleId: string) => {
        const rule = rules.find(r => r.id === ruleId);
        if (rule) {
            await saveRule({ ...rule, enabled: !rule.enabled, updatedAt: Date.now() });
        }
    }, [rules, saveRule]);

    // Process a bookmark through all rules
    const processBookmark = useCallback((
        bookmark: Bookmark,
        folders: Folder[]
    ): { result: Bookmark; matchedRules: string[] } => {
        return processBookmarkWithRules(bookmark, rules, folders);
    }, [rules]);

    // Process a note through all rules
    const processNote = useCallback((
        note: Note,
        notebooks: Notebook[]
    ): { result: Note; matchedRules: string[] } => {
        return processNoteWithRules(note, rules, notebooks);
    }, [rules]);

    // Add preset rules
    const addPresetRules = useCallback(async () => {
        for (const preset of PRESET_RULES) {
            if (preset.name && preset.condition && preset.action) {
                await addRule(preset.name, preset.condition, preset.action);
            }
        }
    }, [addRule]);

    // Increment match count
    const recordMatch = useCallback(async (ruleId: string) => {
        const rule = rules.find(r => r.id === ruleId);
        if (rule) {
            await saveRule({ ...rule, matchCount: rule.matchCount + 1 });
        }
    }, [rules, saveRule]);

    return {
        rules,
        isLoading,
        saveRule,
        deleteRule,
        addRule,
        toggleRule,
        processBookmark,
        processNote,
        addPresetRules,
        recordMatch,
        enabledRules: rules.filter(r => r.enabled),
    };
}
