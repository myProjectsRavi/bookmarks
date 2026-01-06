import React, { useState } from 'react';
import { Crown, Check, X, Sparkles, History, Trash2, Network, Copy, Smartphone, Zap } from 'lucide-react';

interface PremiumModalProps {
    onClose: () => void;
    currentPlan: 'free' | 'pro';
}

export const PremiumModal: React.FC<PremiumModalProps> = ({ onClose, currentPlan }) => {
    const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'lifetime'>('lifetime');

    const proFeatures = [
        { icon: <History size={18} />, name: 'Version History', description: 'Restore previous note versions' },
        { icon: <Trash2 size={18} />, name: 'Trash Bin', description: '30-day recovery for deleted items' },
        { icon: <Network size={18} />, name: 'Knowledge Graph', description: 'Visual map of your knowledge' },
        { icon: <Copy size={18} />, name: 'Find Duplicates', description: 'Detect similar bookmarks' },
        { icon: <Smartphone size={18} />, name: 'Sync Devices', description: 'Cloud sync across devices' },
    ];

    return (
        <div className="relative">
            {/* Close Button */}
            <button
                onClick={onClose}
                className="absolute -top-2 -right-2 p-1.5 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors z-10"
            >
                <X size={16} className="text-slate-600" />
            </button>

            {/* Header */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-200 mb-4">
                    <Crown size={32} className="text-white" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Upgrade to Pro</h2>
                <p className="text-slate-500">Unlock powerful features to supercharge your productivity</p>
            </div>

            {/* Plans */}
            <div className="grid grid-cols-2 gap-4 mb-8">
                {/* Free Plan */}
                <div className={`rounded-2xl border-2 p-6 transition-all ${currentPlan === 'free' ? 'border-slate-300 bg-slate-50' : 'border-slate-200'
                    }`}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-slate-700">Free</h3>
                        {currentPlan === 'free' && (
                            <span className="text-xs font-medium bg-slate-200 text-slate-600 px-2 py-1 rounded-full">Current</span>
                        )}
                    </div>
                    <div className="mb-6">
                        <span className="text-3xl font-bold text-slate-800">$0</span>
                        <span className="text-slate-500">/forever</span>
                    </div>
                    <ul className="space-y-3">
                        <li className="flex items-center gap-2 text-sm text-slate-600">
                            <Check size={16} className="text-emerald-500" />
                            Unlimited bookmarks
                        </li>
                        <li className="flex items-center gap-2 text-sm text-slate-600">
                            <Check size={16} className="text-emerald-500" />
                            Unlimited notes
                        </li>
                        <li className="flex items-center gap-2 text-sm text-slate-600">
                            <Check size={16} className="text-emerald-500" />
                            Tags & folders
                        </li>
                        <li className="flex items-center gap-2 text-sm text-slate-600">
                            <Check size={16} className="text-emerald-500" />
                            PIN protection
                        </li>
                        <li className="flex items-center gap-2 text-sm text-slate-600">
                            <Check size={16} className="text-emerald-500" />
                            Search & filter
                        </li>
                    </ul>
                </div>

                {/* Pro Plan */}
                <div className={`rounded-2xl border-2 p-6 transition-all relative overflow-hidden ${currentPlan === 'pro' ? 'border-indigo-500 bg-indigo-50' : 'border-indigo-300 bg-gradient-to-br from-indigo-50 to-purple-50'
                    }`}>
                    {/* Popular badge */}
                    <div className="absolute top-0 right-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold px-4 py-1 rounded-bl-xl">
                        POPULAR
                    </div>

                    <div className="flex items-center gap-2 mb-4">
                        <h3 className="text-lg font-semibold text-indigo-700">Pro</h3>
                        <Sparkles size={16} className="text-amber-500" />
                        {currentPlan === 'pro' && (
                            <span className="text-xs font-medium bg-indigo-200 text-indigo-700 px-2 py-1 rounded-full">Active</span>
                        )}
                    </div>

                    {/* Price Toggle */}
                    <div className="mb-6">
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold text-indigo-700">
                                {selectedPlan === 'monthly' ? '$3' : '$19.99'}
                            </span>
                            <span className="text-indigo-500">
                                {selectedPlan === 'monthly' ? '/month' : ' lifetime'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <button
                                onClick={() => setSelectedPlan('monthly')}
                                className={`text-xs px-2.5 py-1 rounded-full transition-colors ${selectedPlan === 'monthly'
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                                    }`}
                            >
                                Monthly
                            </button>
                            <button
                                onClick={() => setSelectedPlan('lifetime')}
                                className={`text-xs px-2.5 py-1 rounded-full transition-colors ${selectedPlan === 'lifetime'
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                                    }`}
                            >
                                Lifetime 🔥
                            </button>
                        </div>
                        {selectedPlan === 'lifetime' && (
                            <p className="text-xs text-indigo-600 mt-2 font-medium">
                                💰 Save $16/year vs monthly!
                            </p>
                        )}
                    </div>

                    <ul className="space-y-3">
                        <li className="flex items-center gap-2 text-sm text-indigo-700 font-medium">
                            <Check size={16} className="text-emerald-500" />
                            Everything in Free
                        </li>
                        {proFeatures.map((feature, index) => (
                            <li key={index} className="flex items-center gap-2 text-sm text-indigo-700">
                                <span className="text-indigo-500">{feature.icon}</span>
                                {feature.name}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Feature Details */}
            <div className="bg-slate-50 rounded-xl p-4 mb-6">
                <h4 className="font-medium text-slate-700 mb-3 flex items-center gap-2">
                    <Zap size={16} className="text-amber-500" />
                    Pro Features in Detail
                </h4>
                <div className="grid grid-cols-2 gap-3">
                    {proFeatures.map((feature, index) => (
                        <div key={index} className="flex items-start gap-2">
                            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-indigo-500 flex-shrink-0">
                                {feature.icon}
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-700">{feature.name}</p>
                                <p className="text-xs text-slate-500">{feature.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* CTA */}
            {currentPlan === 'free' && (
                <button
                    onClick={() => {
                        // TODO: Implement payment integration
                        alert('Payment integration coming soon! For now, enjoy all features for free during beta.');
                        onClose();
                    }}
                    className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-200 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                >
                    <Crown size={20} />
                    Upgrade to Pro — {selectedPlan === 'monthly' ? '$3/month' : '$19.99 lifetime'}
                </button>
            )}

            {currentPlan === 'pro' && (
                <div className="text-center py-4 bg-emerald-50 rounded-xl border border-emerald-200">
                    <p className="text-emerald-700 font-medium flex items-center justify-center gap-2">
                        <Check size={18} />
                        You're already on Pro! Enjoy all features.
                    </p>
                </div>
            )}

            {/* Guarantee */}
            <p className="text-center text-xs text-slate-500 mt-4">
                🔒 30-day money-back guarantee • 💳 Secure payment via Stripe
            </p>
        </div>
    );
};
