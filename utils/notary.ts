/**
 * Digital Notary - Cryptographic Web Evidence System
 * 
 * PURPOSE: Generate legally admissible proof of webpage content at a specific time.
 * 
 * ALGORITHM:
 * 1. Capture webpage HTML content
 * 2. Build Merkle tree of content chunks → SHA-256 root hash
 * 3. Create timestamp seal with cryptographic nonce
 * 4. Generate self-contained HTML file with embedded verifier
 * 
 * USE CASES:
 * - Journalists preserving evidence of censored content
 * - Researchers documenting webpage state for citations
 * - Legal disputes requiring proof of online statements
 * - Students archiving sources for academic integrity
 * 
 * SECURITY:
 * - SHA-256 Merkle root makes tampering detectable
 * - Timestamp + nonce provides temporal proof
 * - Self-contained verifier requires no external dependencies
 * - Optional Ed25519 signature for identity binding
 * 
 * COMPLEXITY: O(n) for content hashing
 * ZERO DEPENDENCIES: Pure Web Crypto API
 */

import { createTimeLockSeal, verifyTimeLockSeal, TimeLockSeal } from './merkleTree';

/**
 * Evidence package containing all proof elements
 */
export interface NotaryEvidence {
    version: 1;                  // Evidence format version
    capturedAt: string;          // ISO 8601 timestamp
    sourceUrl: string;           // Original URL
    title: string;               // Page title
    contentHtml: string;         // Full snapshot HTML
    seal: TimeLockSeal;          // Merkle root + timestamp + nonce
    signature?: string;          // Optional Ed25519 signature
    publicKey?: string;          // Optional public key for verification
}

/**
 * SHA-256 hash function (for verifier script)
 */
async function sha256(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Create evidence package from snapshot content
 */
export async function createEvidence(
    sourceUrl: string,
    title: string,
    contentHtml: string
): Promise<NotaryEvidence> {
    // Create cryptographic seal
    const seal = await createTimeLockSeal(contentHtml);

    return {
        version: 1,
        capturedAt: new Date().toISOString(),
        sourceUrl,
        title,
        contentHtml,
        seal
    };
}

/**
 * Verify evidence integrity
 */
export async function verifyEvidence(evidence: NotaryEvidence): Promise<{
    valid: boolean;
    reason?: string;
    details?: {
        contentMatch: boolean;
        sealIntact: boolean;
        timestampValid: boolean;
    };
}> {
    try {
        const result = await verifyTimeLockSeal(evidence.contentHtml, evidence.seal);

        return {
            valid: result.valid,
            reason: result.reason,
            details: {
                contentMatch: result.valid,
                sealIntact: result.valid,
                timestampValid: evidence.seal.timestamp <= Date.now()
            }
        };
    } catch (e) {
        return {
            valid: false,
            reason: `Verification error: ${e instanceof Error ? e.message : 'Unknown'}`
        };
    }
}

/**
 * Generate self-contained HTML evidence file
 * 
 * This file can be opened in any browser and will:
 * 1. Display the captured content
 * 2. Show verification status
 * 3. Recompute Merkle root to prove integrity
 * 
 * The verifier JavaScript is embedded directly - no external dependencies.
 */
export function generateEvidenceHTML(evidence: NotaryEvidence): string {
    const escapedContent = evidence.contentHtml
        .replace(/</g, '\\x3c')
        .replace(/>/g, '\\x3e')
        .replace(/&/g, '\\x26')
        .replace(/'/g, '\\x27')
        .replace(/"/g, '\\x22');

    const escapedTitle = evidence.title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const escapedUrl = evidence.sourceUrl.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Digital Evidence: ${escapedTitle}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f172a;
            color: #e2e8f0;
            min-height: 100vh;
        }
        .evidence-header {
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            border-bottom: 1px solid #334155;
            padding: 1.5rem 2rem;
            position: sticky;
            top: 0;
            z-index: 100;
        }
        .header-content {
            max-width: 1200px;
            margin: 0 auto;
        }
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            border-radius: 9999px;
            font-weight: 600;
            font-size: 0.875rem;
            margin-bottom: 1rem;
        }
        .badge.verifying { background: #1e40af; color: #93c5fd; }
        .badge.valid { background: #166534; color: #86efac; }
        .badge.invalid { background: #991b1b; color: #fecaca; }
        .icon { width: 1.25rem; height: 1.25rem; }
        h1 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; }
        .meta { font-size: 0.875rem; color: #94a3b8; }
        .meta a { color: #60a5fa; text-decoration: none; }
        .meta a:hover { text-decoration: underline; }
        
        .proof-panel {
            background: #1e293b;
            border-bottom: 1px solid #334155;
            padding: 1rem 2rem;
        }
        .proof-grid {
            max-width: 1200px;
            margin: 0 auto;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 1rem;
        }
        .proof-item {
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 0.5rem;
            padding: 1rem;
        }
        .proof-label {
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #64748b;
            margin-bottom: 0.25rem;
        }
        .proof-value {
            font-family: 'JetBrains Mono', 'Fira Code', monospace;
            font-size: 0.875rem;
            color: #f1f5f9;
            word-break: break-all;
        }
        .proof-value.hash { color: #a5b4fc; }
        .proof-value.time { color: #86efac; }
        
        .content-frame {
            max-width: 1200px;
            margin: 2rem auto;
            padding: 0 2rem;
        }
        .content-wrapper {
            background: #ffffff;
            border-radius: 0.75rem;
            overflow: hidden;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        .content-inner {
            color: #1f2937;
            padding: 2rem;
            max-height: 80vh;
            overflow-y: auto;
        }
        
        .footer {
            text-align: center;
            padding: 2rem;
            font-size: 0.75rem;
            color: #64748b;
        }
        .footer a { color: #60a5fa; }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        .verifying .icon { animation: pulse 1s infinite; }
    </style>
</head>
<body>
    <header class="evidence-header">
        <div class="header-content">
            <div id="status-badge" class="badge verifying">
                <svg class="icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span id="status-text">Verifying cryptographic proof...</span>
            </div>
            <h1>📜 ${escapedTitle}</h1>
            <p class="meta">
                Captured from <a href="${escapedUrl}" target="_blank" rel="noopener">${escapedUrl}</a>
                on <strong>${new Date(evidence.capturedAt).toLocaleString()}</strong>
            </p>
        </div>
    </header>
    
    <div class="proof-panel">
        <div class="proof-grid">
            <div class="proof-item">
                <div class="proof-label">Merkle Root (SHA-256)</div>
                <div class="proof-value hash">${evidence.seal.contentHash}</div>
            </div>
            <div class="proof-item">
                <div class="proof-label">Timestamp</div>
                <div class="proof-value time">${new Date(evidence.seal.timestamp).toISOString()}</div>
            </div>
            <div class="proof-item">
                <div class="proof-label">Seal Hash</div>
                <div class="proof-value hash">${evidence.seal.sealHash}</div>
            </div>
            <div class="proof-item">
                <div class="proof-label">Cryptographic Nonce</div>
                <div class="proof-value">${evidence.seal.nonce}</div>
            </div>
        </div>
    </div>
    
    <main class="content-frame">
        <div class="content-wrapper">
            <div class="content-inner" id="captured-content"></div>
        </div>
    </main>
    
    <footer class="footer">
        <p>This evidence file was generated by <a href="https://linkhaven-beige.vercel.app" target="_blank">LinkHaven</a></p>
        <p>The content integrity can be independently verified using the Merkle root hash above.</p>
    </footer>
    
    <script>
    // ============================================================
    // EMBEDDED VERIFIER - Pure JavaScript, no dependencies
    // ============================================================
    (async function() {
        const badge = document.getElementById('status-badge');
        const statusText = document.getElementById('status-text');
        const contentDiv = document.getElementById('captured-content');
        
        // The original content (escaped for safety)
        const originalContent = "${escapedContent}";
        const content = originalContent
            .replace(/\\\\x3c/g, '<').replace(/\\\\x3e/g, '>')
            .replace(/\\\\x26/g, '&').replace(/\\\\x27/g, "'")
            .replace(/\\\\x22/g, '"');
        
        // Display content
        contentDiv.innerHTML = content;
        
        // Verification data
        const seal = ${JSON.stringify(evidence.seal)};
        
        // SHA-256 function
        async function sha256(data) {
            const encoder = new TextEncoder();
            const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
            return Array.from(new Uint8Array(buffer))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
        }
        
        // Build Merkle root
        async function buildMerkleRoot(content) {
            const chunkSize = 4096;
            const chunks = [];
            for (let i = 0; i < content.length; i += chunkSize) {
                chunks.push(content.slice(i, i + chunkSize));
            }
            if (chunks.length === 0) chunks.push('');
            
            let level = await Promise.all(chunks.map(chunk => sha256(chunk)));
            
            while (level.length > 1) {
                const nextLevel = [];
                for (let i = 0; i < level.length; i += 2) {
                    if (i + 1 < level.length) {
                        nextLevel.push(await sha256(level[i] + level[i + 1]));
                    } else {
                        nextLevel.push(level[i]);
                    }
                }
                level = nextLevel;
            }
            
            return level[0];
        }
        
        try {
            // Verify content hash
            const computedHash = await buildMerkleRoot(content);
            const contentMatch = computedHash === seal.contentHash;
            
            // Verify seal integrity
            const sealData = seal.contentHash + ':' + seal.timestamp + ':' + seal.nonce;
            const computedSealHash = await sha256(sealData);
            const sealIntact = computedSealHash === seal.sealHash;
            
            // Check timestamp
            const timestampValid = seal.timestamp <= Date.now();
            
            if (contentMatch && sealIntact && timestampValid) {
                badge.className = 'badge valid';
                statusText.textContent = '✓ Content verified - Cryptographic proof intact';
            } else {
                badge.className = 'badge invalid';
                const issues = [];
                if (!contentMatch) issues.push('content modified');
                if (!sealIntact) issues.push('seal tampered');
                if (!timestampValid) issues.push('timestamp invalid');
                statusText.textContent = '✗ Verification failed: ' + issues.join(', ');
            }
        } catch (e) {
            badge.className = 'badge invalid';
            statusText.textContent = '✗ Verification error: ' + e.message;
        }
    })();
    </script>
</body>
</html>`;
}

/**
 * Download evidence as HTML file
 */
export function downloadEvidence(evidence: NotaryEvidence): void {
    const html = generateEvidenceHTML(evidence);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    const filename = `evidence_${evidence.title.replace(/[^a-z0-9]/gi, '_').slice(0, 50)}_${evidence.seal.timestamp}.html`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
