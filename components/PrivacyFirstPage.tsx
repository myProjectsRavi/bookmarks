/**
 * PrivacyFirstPage - EU Marketing Landing Component
 * 
 * "GDPR by architecture, not by compliance."
 * 
 * This component showcases LinkHaven's privacy-first approach
 * for European users and privacy-conscious customers.
 */

import React from 'react';
import {
    Shield,
    Lock,
    Eye,
    EyeOff,
    Database,
    Server,
    Cloud,
    CloudOff,
    Check,
    X,
    Fingerprint,
    FileKey,
    Smartphone,
    Globe,
    Heart
} from 'lucide-react';

interface PrivacyFeature {
    icon: React.ReactNode;
    title: string;
    description: string;
    technical: string;
}

const privacyFeatures: PrivacyFeature[] = [
    {
        icon: <CloudOff className="text-emerald-500" size={32} />,
        title: "Zero Cloud Storage",
        description: "Your data stays on YOUR device. We never see it.",
        technical: "IndexedDB + localStorage only"
    },
    {
        icon: <Lock className="text-indigo-500" size={32} />,
        title: "AES-256-GCM Encryption",
        description: "Bank-grade encryption for your vault.",
        technical: "PBKDF2 with 600,000 iterations"
    },
    {
        icon: <Database className="text-amber-500" size={32} />,
        title: "No Database = No Breach",
        description: "We can't leak what we don't have.",
        technical: "Ed25519 signed licenses, zero DB queries"
    },
    {
        icon: <EyeOff className="text-purple-500" size={32} />,
        title: "No Analytics, No Tracking",
        description: "Zero cookies. Zero tracking pixels. Zero telemetry.",
        technical: "No third-party scripts loaded"
    },
    {
        icon: <Fingerprint className="text-rose-500" size={32} />,
        title: "Duress PIN Protection",
        description: "Show an empty vault under coercion.",
        technical: "HMAC-SHA256 PIN verification"
    },
    {
        icon: <FileKey className="text-cyan-500" size={32} />,
        title: "Steganographic Backup",
        description: "Hide your encrypted data in ordinary images.",
        technical: "LSB encoding with AES payload"
    },
];

interface ComparisonRow {
    feature: string;
    linkhaven: boolean | string;
    typical: boolean | string;
}

const comparisonData: ComparisonRow[] = [
    { feature: "Account Required", linkhaven: false, typical: true },
    { feature: "Server Storage", linkhaven: false, typical: true },
    { feature: "Cookies Used", linkhaven: false, typical: true },
    { feature: "Analytics Tracking", linkhaven: false, typical: true },
    { feature: "Third-Party SDKs", linkhaven: false, typical: true },
    { feature: "Data Encryption", linkhaven: "AES-256-GCM", typical: "Varies" },
    { feature: "GDPR Compliant", linkhaven: "By Design", typical: "By Policy" },
    { feature: "Open Source", linkhaven: true, typical: false },
];

export const PrivacyFirstPage: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
            {/* Hero Section */}
            <header className="relative py-20 px-6 text-center overflow-hidden">
                {/* Animated background */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px]"></div>
                </div>

                <div className="relative z-10 max-w-4xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-sm font-medium mb-6">
                        <Shield size={16} />
                        100% GDPR Compliant by Design
                    </div>

                    <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-emerald-200 to-emerald-400 bg-clip-text text-transparent">
                        Privacy-First
                        <br />
                        Bookmark Manager
                    </h1>

                    <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-8">
                        The only bookmark manager that doesn't need a Privacy Officer,
                        <br />
                        <span className="text-emerald-400 font-semibold">because we don't have your data.</span>
                    </p>

                    <div className="flex flex-wrap gap-4 justify-center">
                        <a
                            href="https://linkhaven-beige.vercel.app"
                            className="px-8 py-4 bg-emerald-500 hover:bg-emerald-600 rounded-xl font-semibold transition-all transform hover:scale-105"
                        >
                            Try LinkHaven Free
                        </a>
                        <a
                            href="https://github.com/raviteja-nekkalapu/linkhaven"
                            className="px-8 py-4 bg-white/10 hover:bg-white/20 rounded-xl font-semibold transition-colors"
                        >
                            View Source Code
                        </a>
                    </div>
                </div>
            </header>

            {/* Key Points */}
            <section className="py-16 px-6">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-2xl font-bold text-center mb-12">
                        Privacy Features
                    </h2>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {privacyFeatures.map((feature, index) => (
                            <div
                                key={index}
                                className="p-6 bg-slate-800/50 border border-slate-700/50 rounded-2xl hover:border-emerald-500/30 transition-colors"
                            >
                                <div className="mb-4">{feature.icon}</div>
                                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                                <p className="text-slate-400 mb-3">{feature.description}</p>
                                <code className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
                                    {feature.technical}
                                </code>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Comparison Table */}
            <section className="py-16 px-6 bg-slate-800/30">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-2xl font-bold text-center mb-4">
                        LinkHaven vs Typical Cloud Apps
                    </h2>
                    <p className="text-slate-400 text-center mb-12">
                        Most bookmark managers store your data on their servers.
                        <br />We chose a different path.
                    </p>

                    <div className="overflow-hidden rounded-2xl border border-slate-700">
                        <table className="w-full">
                            <thead className="bg-slate-800">
                                <tr>
                                    <th className="text-left p-4 font-semibold">Feature</th>
                                    <th className="p-4 font-semibold">
                                        <div className="flex items-center justify-center gap-2">
                                            <Shield size={18} className="text-emerald-500" />
                                            LinkHaven
                                        </div>
                                    </th>
                                    <th className="p-4 font-semibold">
                                        <div className="flex items-center justify-center gap-2">
                                            <Cloud size={18} className="text-slate-400" />
                                            Typical Apps
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {comparisonData.map((row, index) => (
                                    <tr key={index} className="hover:bg-slate-800/30">
                                        <td className="p-4 text-slate-300">{row.feature}</td>
                                        <td className="p-4 text-center">
                                            {typeof row.linkhaven === 'boolean' ? (
                                                row.linkhaven ? (
                                                    <Check className="inline text-emerald-500" size={20} />
                                                ) : (
                                                    <X className="inline text-red-400" size={20} />
                                                )
                                            ) : (
                                                <span className="text-emerald-400 font-medium">{row.linkhaven}</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            {typeof row.typical === 'boolean' ? (
                                                row.typical ? (
                                                    <Check className="inline text-amber-500" size={20} />
                                                ) : (
                                                    <X className="inline text-slate-500" size={20} />
                                                )
                                            ) : (
                                                <span className="text-slate-400">{row.typical}</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* GDPR Section */}
            <section className="py-16 px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <Globe size={48} className="mx-auto text-blue-400 mb-6" />
                    <h2 className="text-2xl font-bold mb-4">
                        Built for European Privacy Standards
                    </h2>
                    <p className="text-slate-400 mb-8 max-w-2xl mx-auto">
                        GDPR (General Data Protection Regulation) grants EU citizens rights over their personal data.
                        LinkHaven exceeds these requirements by simply not collecting any data.
                    </p>

                    <div className="grid md:grid-cols-3 gap-6 text-left">
                        <div className="p-6 bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/30 rounded-2xl">
                            <h3 className="font-semibold mb-2">Right to Access</h3>
                            <p className="text-sm text-slate-400">
                                ✓ Your data is already on your device. View it anytime.
                            </p>
                        </div>
                        <div className="p-6 bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/30 rounded-2xl">
                            <h3 className="font-semibold mb-2">Right to Erasure</h3>
                            <p className="text-sm text-slate-400">
                                ✓ Clear your browser data. Done. We have nothing to delete.
                            </p>
                        </div>
                        <div className="p-6 bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/30 rounded-2xl">
                            <h3 className="font-semibold mb-2">Right to Portability</h3>
                            <p className="text-sm text-slate-400">
                                ✓ Export via QR sync, JSON, or steganographic backup.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer CTA */}
            <footer className="py-16 px-6 text-center border-t border-slate-800">
                <div className="max-w-2xl mx-auto">
                    <Heart size={32} className="mx-auto text-rose-400 mb-6" />
                    <p className="text-xl text-slate-300 mb-8">
                        Made with privacy in mind. Open source forever.
                        <br />
                        <span className="text-emerald-400">$24/year Pro</span> • Unlimited devices • No tracking
                    </p>

                    {onClose && (
                        <button
                            onClick={onClose}
                            className="px-8 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors"
                        >
                            Back to LinkHaven
                        </button>
                    )}
                </div>
            </footer>
        </div>
    );
};
