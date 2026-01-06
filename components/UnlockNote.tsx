import React, { useState } from 'react';
import { Lock, KeyRound, AlertCircle, Check, FileText } from 'lucide-react';
import { decryptSharedNote } from './SecureNoteShare';

interface UnlockNoteProps {
    onClose: () => void;
}

export const UnlockNote: React.FC<UnlockNoteProps> = ({ onClose }) => {
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [decryptedNote, setDecryptedNote] = useState<{ title: string; content: string } | null>(null);
    const [isDecrypting, setIsDecrypting] = useState(false);
    const [error, setError] = useState('');

    const handleDecrypt = async () => {
        if (!code.trim() || !password.trim()) {
            setError('Please enter both the share code and password');
            return;
        }

        setIsDecrypting(true);
        setError('');

        try {
            const result = await decryptSharedNote(code.trim(), password);
            if (result) {
                setDecryptedNote(result);
            } else {
                setError('Decryption failed. Check your code and password.');
            }
        } catch (e) {
            setError('Invalid code or password. Please try again.');
        }

        setIsDecrypting(false);
    };

    return (
        <div className="space-y-4">
            {/* Security Badge */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg p-4 text-center border border-purple-200">
                <Lock size={48} className="mx-auto text-purple-600 mb-2" />
                <h3 className="font-semibold text-slate-800 mb-1">🔓 Unlock Shared Note</h3>
                <p className="text-sm text-slate-600">
                    Decrypt a note that was securely shared with you
                </p>
            </div>

            {!decryptedNote ? (
                <>
                    {/* Code Input */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            <FileText size={14} className="inline mr-1" />
                            Paste Share Code
                        </label>
                        <textarea
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder="Paste the encrypted share code here..."
                            className="w-full h-24 px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all resize-none font-mono text-xs"
                        />
                    </div>

                    {/* Password Input */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            <KeyRound size={14} className="inline mr-1" />
                            Enter Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password shared by your friend..."
                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all"
                        />
                        <p className="text-xs text-slate-400 mt-1">
                            Your friend should have shared this password separately
                        </p>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleDecrypt}
                        disabled={isDecrypting || !code.trim() || !password.trim()}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-400 text-white font-medium rounded-xl shadow-lg shadow-purple-200 transition-all"
                    >
                        <Lock size={18} />
                        {isDecrypting ? 'Decrypting...' : 'Unlock Note'}
                    </button>
                </>
            ) : (
                <>
                    {/* Success Badge */}
                    <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 p-3 rounded-lg">
                        <Check size={16} />
                        Note decrypted successfully!
                    </div>

                    {/* Decrypted Note */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                        <h4 className="font-semibold text-slate-800 mb-2 text-lg">
                            {decryptedNote.title}
                        </h4>
                        <div className="max-h-64 overflow-y-auto">
                            <pre className="whitespace-pre-wrap font-sans text-slate-600 leading-relaxed text-sm">
                                {decryptedNote.content}
                            </pre>
                        </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                        <strong>📝 Note:</strong> This is a read-only view. The shared note is not saved to your device.
                    </div>

                    <button
                        onClick={() => { setDecryptedNote(null); setCode(''); setPassword(''); }}
                        className="w-full py-2 text-sm font-medium text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                    >
                        Unlock Another Note
                    </button>
                </>
            )}

            {/* Close Button */}
            <div className="pt-2 border-t border-slate-100">
                <button
                    onClick={onClose}
                    className="w-full py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                    Close
                </button>
            </div>
        </div>
    );
};
