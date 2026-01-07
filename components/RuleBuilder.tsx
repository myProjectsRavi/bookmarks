/**
 * RuleBuilder - Visual UI for creating automation rules
 * 
 * Premium feature for automatic bookmark/note organization.
 */

import React, { useState } from 'react';
import { X, Plus, Trash2, Zap, HelpCircle, ChevronDown, Check } from 'lucide-react';
import { AutomationRule, RuleCondition, RuleAction, PRESET_RULES } from '../utils/ruleEngine';

interface RuleBuilderProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string, condition: RuleCondition, action: RuleAction) => Promise<void>;
    existingRule?: AutomationRule;
}

// Condition types for dropdown
const CONDITION_TYPES = [
    { value: 'url_contains', label: 'URL contains' },
    { value: 'url_domain', label: 'Domain is' },
    { value: 'title_contains', label: 'Title contains' },
    { value: 'has_tag', label: 'Has tag' },
    { value: 'no_tags', label: 'Has no tags' },
];

// Action types for dropdown
const ACTION_TYPES = [
    { value: 'add_tag', label: 'Add tag' },
    { value: 'move_folder', label: 'Move to folder' },
    { value: 'remove_tag', label: 'Remove tag' },
];

export const RuleBuilder: React.FC<RuleBuilderProps> = ({
    isOpen,
    onClose,
    onSave,
    existingRule,
}) => {
    const [name, setName] = useState(existingRule?.name || '');
    const [conditionType, setConditionType] = useState('url_contains');
    const [conditionValue, setConditionValue] = useState('');
    const [actionType, setActionType] = useState('add_tag');
    const [actionValue, setActionValue] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [showPresets, setShowPresets] = useState(false);

    if (!isOpen) return null;

    const buildCondition = (): RuleCondition => {
        switch (conditionType) {
            case 'url_contains':
                return { url: { contains: conditionValue } };
            case 'url_domain':
                return { url: { domain: conditionValue } };
            case 'title_contains':
                return { content: { titleContains: conditionValue } };
            case 'has_tag':
                return { tag: { hasTag: conditionValue } };
            case 'no_tags':
                return { tag: { noTags: true } };
            default:
                return {};
        }
    };

    const buildAction = (): RuleAction => {
        switch (actionType) {
            case 'add_tag':
                return { addTag: actionValue };
            case 'move_folder':
                return { moveToFolder: actionValue };
            case 'remove_tag':
                return { removeTag: actionValue };
            default:
                return {};
        }
    };

    const handleSave = async () => {
        if (!name.trim()) return;

        setIsSaving(true);
        try {
            await onSave(name, buildCondition(), buildAction());
            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    const applyPreset = (preset: typeof PRESET_RULES[0]) => {
        setName(preset.name || '');
        setShowPresets(false);

        // Parse condition
        if (preset.condition?.url?.contains) {
            setConditionType('url_contains');
            setConditionValue(preset.condition.url.contains);
        } else if (preset.condition?.url?.domain) {
            setConditionType('url_domain');
            setConditionValue(preset.condition.url.domain);
        }

        // Parse action
        if (preset.action?.addTag) {
            setActionType('add_tag');
            setActionValue(preset.action.addTag);
        } else if (preset.action?.moveToFolder) {
            setActionType('move_folder');
            setActionValue(preset.action.moveToFolder);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <Zap size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">
                                {existingRule ? 'Edit Rule' : 'Create Automation Rule'}
                            </h2>
                            <p className="text-indigo-100 text-sm">Set up automatic organization</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-white" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Presets */}
                    <div className="relative">
                        <button
                            onClick={() => setShowPresets(!showPresets)}
                            className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                        >
                            <HelpCircle size={14} />
                            Use a preset
                            <ChevronDown size={14} className={showPresets ? 'rotate-180' : ''} />
                        </button>

                        {showPresets && (
                            <div className="absolute top-8 left-0 bg-white border rounded-lg shadow-lg z-10 w-72">
                                {PRESET_RULES.map((preset, i) => (
                                    <button
                                        key={i}
                                        onClick={() => applyPreset(preset)}
                                        className="w-full px-4 py-2 text-left text-sm hover:bg-indigo-50 flex items-center gap-2"
                                    >
                                        <Plus size={14} className="text-indigo-500" />
                                        {preset.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Rule Name */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Rule Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Tag GitHub repos"
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </div>

                    {/* Condition */}
                    <div className="bg-slate-50 rounded-lg p-4">
                        <label className="block text-sm font-semibold text-slate-700 mb-3">
                            IF (Condition)
                        </label>
                        <div className="flex gap-2">
                            <select
                                value={conditionType}
                                onChange={(e) => setConditionType(e.target.value)}
                                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
                            >
                                {CONDITION_TYPES.map((type) => (
                                    <option key={type.value} value={type.value}>
                                        {type.label}
                                    </option>
                                ))}
                            </select>
                            {conditionType !== 'no_tags' && (
                                <input
                                    type="text"
                                    value={conditionValue}
                                    onChange={(e) => setConditionValue(e.target.value)}
                                    placeholder="value..."
                                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                />
                            )}
                        </div>
                    </div>

                    {/* Action */}
                    <div className="bg-indigo-50 rounded-lg p-4">
                        <label className="block text-sm font-semibold text-indigo-700 mb-3">
                            THEN (Action)
                        </label>
                        <div className="flex gap-2">
                            <select
                                value={actionType}
                                onChange={(e) => setActionType(e.target.value)}
                                className="flex-1 px-3 py-2 border border-indigo-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
                            >
                                {ACTION_TYPES.map((type) => (
                                    <option key={type.value} value={type.value}>
                                        {type.label}
                                    </option>
                                ))}
                            </select>
                            <input
                                type="text"
                                value={actionValue}
                                onChange={(e) => setActionValue(e.target.value)}
                                placeholder="value..."
                                className="flex-1 px-3 py-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="bg-slate-100 rounded-lg p-4 text-sm text-slate-600">
                        <span className="font-medium">Preview:</span>{' '}
                        IF {CONDITION_TYPES.find(c => c.value === conditionType)?.label.toLowerCase()}{' '}
                        {conditionType !== 'no_tags' && `"${conditionValue || '...'}" `}
                        THEN {ACTION_TYPES.find(a => a.value === actionType)?.label.toLowerCase()}{' '}
                        "{actionValue || '...'}"
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!name.trim() || isSaving}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isSaving ? (
                            <>Saving...</>
                        ) : (
                            <>
                                <Check size={16} />
                                Save Rule
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
