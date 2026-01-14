
import { parseImportFile } from './importers';
import { describe, it, expect } from 'vitest';

describe('importers - Security Tests', () => {

    it('should prevent XSS by dropping javascript: links in Native JSON import', () => {
        const maliciousJson = JSON.stringify({
            folders: [{ id: '1', name: 'Test', createdAt: 123 }],
            bookmarks: [{
                id: 'b1',
                folderId: '1',
                title: 'Malicious',
                url: "javascript:alert('XSS')",
                createdAt: 123
            }, {
                id: 'b2',
                folderId: '1',
                title: 'Safe',
                url: "https://example.com",
                createdAt: 123
            }]
        });

        const result = parseImportFile(maliciousJson, 'backup.json');

        // Security Check: Malicious bookmark should be filtered out
        expect(result.bookmarks).toHaveLength(1);
        expect(result.bookmarks[0].title).toBe('Safe');
        expect(result.bookmarks[0].url).toBe('https://example.com');
    });

    it('should prevent XSS by dropping javascript: links in Pocket import', () => {
        const maliciousPocket = JSON.stringify({
            list: {
                "1": {
                    resolved_title: "Malicious",
                    resolved_url: "javascript:alert('XSS')",
                    time_added: "123"
                },
                "2": {
                    resolved_title: "Safe",
                    resolved_url: "http://example.com",
                    time_added: "123"
                }
            }
        });

        const result = parseImportFile(maliciousPocket, 'pocket.json');

        // Security Check
        expect(result.bookmarks).toHaveLength(1);
        expect(result.bookmarks[0].title).toBe('Safe');
    });

    it('should prevent XSS by dropping data: links', () => {
         const maliciousJson = JSON.stringify({
            folders: [],
            bookmarks: [{
                id: 'b1',
                folderId: '1',
                title: 'Data XSS',
                url: "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
                createdAt: 123
            }]
        });

        const result = parseImportFile(maliciousJson, 'backup.json');
        expect(result.bookmarks).toHaveLength(0);
    });

    it('should allow legitimate links with whitespace', () => {
        const json = JSON.stringify({
            folders: [],
            bookmarks: [{
                id: 'b1',
                folderId: '1',
                title: 'Whitespace',
                url: " https://example.com ",
                createdAt: 123
            }]
        });

        const result = parseImportFile(json, 'backup.json');
        expect(result.bookmarks).toHaveLength(1);
        expect(result.bookmarks[0].url).toBe(" https://example.com ");
    });
});
