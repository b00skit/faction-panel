import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import api from '../../../api';
import Loading from '../../Loading';
import { 
    ArrowLeft, 
    MessageSquare, 
    CheckCircle, 
    XCircle, 
    Clock, 
    User, 
    Calendar,
    Send,
    Lock,
    Eye,
    Shield,
    ChevronDown,
    Activity
} from 'lucide-react';

interface FormSubmissionReviewProps {
    submissionId: number;
    shortname: string;
    onClose: () => void;
    user: any;
}

const renderResponseValue = (value: any) => {
    if (!value) {
        return <span className="italic text-text-muted">No response provided.</span>;
    }

    let parsedValue = value;
    if (typeof value === 'string' && (value.trim().startsWith('[') || value.trim().startsWith('{'))) {
        try {
            parsedValue = JSON.parse(value);
        } catch {
            // Keep original string
        }
    }

    if (Array.isArray(parsedValue)) {
        if (parsedValue.length === 0) {
            return <span className="italic text-text-muted">No items selected / provided.</span>;
        }
        return (
            <ul className="list-disc pl-5 space-y-1">
                {parsedValue.map((item: any, idx: number) => (
                    <li key={idx} className="text-text text-sm">{String(item)}</li>
                ))}
            </ul>
        );
    }

    return String(parsedValue);
};

const FormSubmissionReview: React.FC<FormSubmissionReviewProps> = ({ submissionId, shortname, onClose, user }) => {
    const [submission, setSubmission] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    
    // Comments states
    const [internalComment, setInternalComment] = useState('');
    const [sectionComments, setSectionComments] = useState<Record<number, string>>({});
    const [submittingComment, setSubmittingComment] = useState<Record<string, boolean>>({}); // 'internal' or sectionId as string
    
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [grades, setGrades] = useState<Record<number, { points: number, comment: string, correctness: 'correct' | 'partially_correct' | 'incorrect' | null }>>({});
    const [grading, setGrading] = useState(false);
    const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({});

    const fetchSubmission = async () => {
        try {
            const res = await api.get(`/factions/${shortname}/forms/submissions/${submissionId}`);
            setSubmission(res.data);
            
            // Initialize grades for fields that have grading enabled
            const initialGrades: Record<number, { points: number, comment: string, correctness: 'correct' | 'partially_correct' | 'incorrect' | null }> = {};
            res.data.responses?.forEach((resp: any) => {
                if (resp.field?.has_grading) {
                    initialGrades[resp.id] = {
                        points: resp.points_awarded || 0,
                        comment: resp.reviewer_comment || '',
                        correctness: resp.correctness || null
                    };
                }
            });
            setGrades(initialGrades);

            // Expand first section by default
            if (res.data.form?.stages?.[0]?.sections?.[0]) {
                setExpandedSections({
                    [res.data.form.stages[0].sections[0].id]: true
                });
            }
        } catch (err) {
            toast.error('Failed to fetch submission');
            onClose();
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSubmission();
    }, [submissionId]);

    // Handle adding an internal comment (reviewer-to-reviewer)
    const handleAddInternalComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!internalComment.trim()) return;

        setSubmittingComment(prev => ({ ...prev, internal: true }));
        try {
            const res = await api.post(`/factions/${shortname}/forms/submissions/${submissionId}/comments`, {
                comment: internalComment,
                is_internal: true
            });
            setSubmission((prev: any) => ({
                ...prev,
                comments: [...prev.comments, res.data]
            }));
            setInternalComment('');
            toast.success('Internal comment added');
        } catch (err) {
            toast.error('Failed to add internal comment');
        } finally {
            setSubmittingComment(prev => ({ ...prev, internal: false }));
        }
    };

    // Handle adding a section-bound public comment (reviewer-to-applicant)
    const handleAddSectionComment = async (sectionId: number, e: React.FormEvent) => {
        e.preventDefault();
        const commentText = sectionComments[sectionId]?.trim();
        if (!commentText) return;

        setSubmittingComment(prev => ({ ...prev, [sectionId]: true }));
        try {
            const res = await api.post(`/factions/${shortname}/forms/submissions/${submissionId}/comments`, {
                comment: commentText,
                is_internal: false,
                form_section_id: sectionId
            });
            setSubmission((prev: any) => ({
                ...prev,
                comments: [...prev.comments, res.data]
            }));
            setSectionComments(prev => ({ ...prev, [sectionId]: '' }));
            toast.success('Feedback comment added');
        } catch (err) {
            toast.error('Failed to add comment');
        } finally {
            setSubmittingComment(prev => ({ ...prev, [sectionId]: false }));
        }
    };

    const handleUpdateStatus = async (statusId: number) => {
        setUpdatingStatus(true);
        try {
            const res = await api.put(`/factions/${shortname}/forms/submissions/${submissionId}/status`, {
                status_id: statusId
            });
            setSubmission({
                ...submission,
                current_status: res.data.submission.current_status,
                current_status_id: res.data.submission.current_status_id
            });
            toast.success('Status updated');
        } catch (err) {
            toast.error('Failed to update status');
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleAdvance = async () => {
        setUpdatingStatus(true);
        try {
            const res = await api.post(`/factions/${shortname}/forms/submissions/${submissionId}/advance`);
            setSubmission({
                ...submission,
                current_stage_id: res.data.submission.current_stage_id,
                current_stage: res.data.submission.current_stage,
                current_status: res.data.submission.current_status,
                current_status_id: res.data.submission.current_status_id,
                submitted_at: res.data.submission.submitted_at
            });
            toast.success('Advanced to next stage');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to advance stage');
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleConclude = async () => {
        setUpdatingStatus(true);
        try {
            const res = await api.post(`/factions/${shortname}/forms/submissions/${submissionId}/conclude`);
            setSubmission({
                ...submission,
                current_status: res.data.submission.current_status,
                current_status_id: res.data.submission.current_status_id
            });
            toast.success('Application concluded');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to conclude application');
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleRetake = async () => {
        setUpdatingStatus(true);
        try {
            const res = await api.post(`/factions/${shortname}/forms/submissions/${submissionId}/retake`);
            setSubmission({
                ...submission,
                current_status: res.data.submission.current_status,
                current_status_id: res.data.submission.current_status_id,
                submitted_at: res.data.submission.submitted_at
            });
            toast.success('Retake initiated');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to initiate retake');
        } finally {
            setUpdatingStatus(false);
        }
    };

    const renderStageActions = () => {
        if (!submission || !submission.current_status) return null;

        const currentStatus = submission.current_status;
        const stagesList = [...(submission.form?.stages || [])].sort((a, b) => a.order - b.order);
        const currentStageIndex = stagesList.findIndex((s: any) => s.id === submission.current_stage_id);
        const hasNextStage = currentStageIndex !== -1 && currentStageIndex < stagesList.length - 1;

        const showAdvance = currentStatus.is_passed && !currentStatus.is_closed && hasNextStage;
        const showConclude = (currentStatus.is_passed && !currentStatus.is_closed && !hasNextStage) || currentStatus.is_closed;
        const showRetake = currentStatus.is_failed && !currentStatus.is_closed;

        if (!showAdvance && !showConclude && !showRetake) return null;

        return (
            <div className="mt-4 pt-4 border-t border-border flex flex-col gap-2">
                <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">
                    Stage Actions
                </h4>
                {showAdvance && (
                    <button
                        onClick={handleAdvance}
                        disabled={updatingStatus}
                        className="w-full text-center px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50"
                    >
                        Continue to Next Stage
                    </button>
                )}
                {showConclude && (
                    <button
                        onClick={handleConclude}
                        disabled={updatingStatus || currentStatus.is_closed}
                        className="w-full text-center px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50"
                    >
                        {currentStatus.is_closed ? 'Application Concluded' : 'Conclude Application'}
                    </button>
                )}
                {showRetake && (
                    <button
                        onClick={handleRetake}
                        disabled={updatingStatus}
                        className="w-full text-center px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50"
                    >
                        Retake Stage
                    </button>
                )}
            </div>
        );
    };

    const handleGradeResponses = async () => {
        setGrading(true);
        try {
            const gradesPayload = Object.entries(grades).map(([id, data]) => {
                const val = data as { points: number; comment: string; correctness: any };
                return {
                    response_id: parseInt(id),
                    points: val.points,
                    comment: val.comment,
                    correctness: val.correctness
                };
            });

            await api.post(`/factions/${shortname}/forms/submissions/${submissionId}/grade`, {
                grades: gradesPayload
            });
            toast.success('Responses graded');
            fetchSubmission();
        } catch (err) {
            toast.error('Failed to grade responses');
        } finally {
            setGrading(false);
        }
    };

    const toggleSection = (sectionId: number) => {
        setExpandedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
    };

    if (loading) return <Loading message="Loading Submission..." />;
    if (!submission) return null;

    const stagesList = [...(submission.form?.stages || [])].sort((a, b) => a.order - b.order);
    
    const getStagePointsReached = (stage: any) => {
        let total = 0;
        stage.sections?.forEach((section: any) => {
            section.fields?.forEach((field: any) => {
                const resp = submission.responses?.find((r: any) => r.form_field_id === field.id);
                if (resp) {
                    const grade = grades[resp.id];
                    if (grade !== undefined) {
                        total += grade.points || 0;
                    } else {
                        total += resp.points_awarded || 0;
                    }
                }
            });
        });
        return total;
    };
    const internalCommentsList = submission.comments?.filter((c: any) => c.is_internal) || [];

    return (
        <div className="flex flex-col h-screen bg-bg">
            {/* Header */}
            <div className="p-4 border-b border-border bg-card flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="p-2 hover:bg-bg rounded-full transition-colors text-text-muted hover:text-text">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-text flex items-center gap-2">
                            Review: {submission.form?.name}
                            <span className="text-xs font-normal text-text-muted">#Sub-{submission.id}</span>
                        </h2>
                        <div className="flex items-center gap-3 text-xs text-text-muted font-bold uppercase tracking-wider mt-1">
                            <span className="flex items-center gap-1">
                                <User size={14} className="text-accent" />
                                {submission.user?.username || 'Guest'}
                            </span>
                            <span className="flex items-center gap-1">
                                <Calendar size={14} className="text-accent" />
                                {new Date(submission.submitted_at || submission.created_at).toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1">
                                <Activity size={14} className="text-accent" />
                                Stage: {submission.current_stage?.name || 'Unknown'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest ${
                        submission.current_status?.is_passed ? 'bg-green-500/10 text-green-500' :
                        submission.current_status?.is_failed ? 'bg-red-500/10 text-red-500' :
                        'bg-blue-500/10 text-blue-500'
                    }`}>
                        {submission.current_status?.name || 'Submitted'}
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Main Content Area: Grouped Responses by Section */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {stagesList.map((stage: any) => {
                        const isCurrentOrPastStage = stagesList.findIndex((s: any) => s.id === submission.current_stage_id) >= stagesList.findIndex((s: any) => s.id === stage.id);
                        if (!isCurrentOrPastStage) return null;

                        return (
                            <div key={stage.id} className="space-y-4">
                                <h3 className="text-xs font-bold text-accent uppercase tracking-widest border-l-2 border-accent pl-3 flex items-center justify-between">
                                    <span>{stage.name}</span>
                                    {submission.form?.type === 'quiz' && (
                                        <span className="text-[10px] bg-card border border-border px-2.5 py-0.5 rounded text-text-muted normal-case font-medium">
                                            Score: {getStagePointsReached(stage)} / {stage.required_points || 0} PTS
                                        </span>
                                    )}
                                </h3>

                                {stage.sections?.map((section: any) => {
                                    const sectionCommentsList = submission.comments?.filter(
                                        (c: any) => c.form_section_id === section.id && !c.is_internal
                                    ) || [];
                                    const isExpanded = expandedSections[section.id];

                                    return (
                                        <div key={section.id} className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                                            {/* Section Toggle Header */}
                                            <button 
                                                onClick={() => toggleSection(section.id)}
                                                className="w-full p-4 flex justify-between items-center bg-bg/25 hover:bg-bg/50 transition-colors"
                                            >
                                                <div className="text-left">
                                                    <h4 className="text-sm font-bold text-text">{section.name}</h4>
                                                    {section.description && (
                                                        <p className="text-[10px] text-text-muted mt-0.5">{section.description}</p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {sectionCommentsList.length > 0 && (
                                                        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-accent/15 text-accent text-[9px] font-bold uppercase tracking-wider">
                                                            <MessageSquare size={10} />
                                                            {sectionCommentsList.length} feedback
                                                        </span>
                                                    )}
                                                    <ChevronDown size={18} className={`text-text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                </div>
                                            </button>

                                            {/* Expandable Section Fields */}
                                            <AnimatePresence initial={false}>
                                                {isExpanded && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.2 }}
                                                        className="border-t border-border"
                                                    >
                                                        <div className="p-6 space-y-6">
                                                            {/* Fields and Responses */}
                                                            <div className="space-y-6">
                                                                {section.fields?.map((field: any) => {
                                                                    const resp = submission.responses?.find((r: any) => r.form_field_id === field.id);
                                                                    if (field.type === 'html') return null;

                                                                    return (
                                                                        <div key={field.id} className="bg-bg/10 border border-border/50 rounded-lg p-5 shadow-sm space-y-3">
                                                                            <div className="flex justify-between items-start">
                                                                                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                                                                                    {field.label}
                                                                                </label>
                                                                            </div>

                                                                            <div className="text-text text-sm whitespace-pre-wrap bg-bg/30 p-4 rounded border border-border/40">
                                                                                {resp ? renderResponseValue(resp.value) : <span className="italic text-text-muted">No response provided.</span>}
                                                                            </div>

                                                                            {field.has_grading && resp && (
                                                                                <div className="flex flex-col gap-3 pt-3 border-t border-border/30">
                                                                                    <div className="flex flex-wrap items-center justify-between gap-4">
                                                                                        <div className="flex items-center gap-1.5">
                                                                                            <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest mr-2">Evaluation:</span>
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    const currentGrade = grades[resp.id] || { points: 0, comment: '', correctness: null };
                                                                                                    setGrades({
                                                                                                        ...grades,
                                                                                                        [resp.id]: {
                                                                                                            ...currentGrade,
                                                                                                            correctness: 'correct',
                                                                                                            points: submission.form?.type === 'quiz' ? field.points : currentGrade.points
                                                                                                        }
                                                                                                    });
                                                                                                }}
                                                                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all flex items-center gap-1 ${
                                                                                                    grades[resp.id]?.correctness === 'correct'
                                                                                                        ? 'bg-green-500/10 border-green-500 text-green-500'
                                                                                                        : 'bg-bg/50 border-border text-text-muted hover:border-green-500/30 hover:text-green-500'
                                                                                                }`}
                                                                                            >
                                                                                                <CheckCircle size={12} />
                                                                                                Correct
                                                                                            </button>
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    const currentGrade = grades[resp.id] || { points: 0, comment: '', correctness: null };
                                                                                                    setGrades({
                                                                                                        ...grades,
                                                                                                        [resp.id]: {
                                                                                                            ...currentGrade,
                                                                                                            correctness: 'partially_correct'
                                                                                                        }
                                                                                                    });
                                                                                                }}
                                                                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all flex items-center gap-1 ${
                                                                                                    grades[resp.id]?.correctness === 'partially_correct'
                                                                                                        ? 'bg-yellow-500/10 border-yellow-500 text-yellow-500'
                                                                                                        : 'bg-bg/50 border-border text-text-muted hover:border-yellow-500/30 hover:text-yellow-500'
                                                                                                }`}
                                                                                            >
                                                                                                <Clock size={12} />
                                                                                                Partially Correct
                                                                                            </button>
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    const currentGrade = grades[resp.id] || { points: 0, comment: '', correctness: null };
                                                                                                    setGrades({
                                                                                                        ...grades,
                                                                                                        [resp.id]: {
                                                                                                            ...currentGrade,
                                                                                                            correctness: 'incorrect',
                                                                                                            points: submission.form?.type === 'quiz' ? 0 : currentGrade.points
                                                                                                        }
                                                                                                    });
                                                                                                }}
                                                                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all flex items-center gap-1 ${
                                                                                                    grades[resp.id]?.correctness === 'incorrect'
                                                                                                        ? 'bg-red-500/10 border-red-500 text-red-500'
                                                                                                        : 'bg-bg/50 border-border text-text-muted hover:border-red-500/30 hover:text-red-500'
                                                                                                }`}
                                                                                            >
                                                                                                <XCircle size={12} />
                                                                                                Incorrect
                                                                                            </button>
                                                                                        </div>

                                                                                        {submission.form?.type === 'quiz' && (
                                                                                            <div className="flex items-center gap-2">
                                                                                                <input 
                                                                                                    type="number"
                                                                                                    value={grades[resp.id]?.points || 0}
                                                                                                    onChange={e => setGrades({...grades, [resp.id]: {...grades[resp.id], points: parseInt(e.target.value) || 0}})}
                                                                                                    className="w-16 bg-bg border border-border rounded px-2 py-1 text-xs font-bold focus:border-accent outline-none text-right"
                                                                                                    max={field.points}
                                                                                                    min={0}
                                                                                                />
                                                                                                <span className="text-[10px] font-bold text-text-muted">/ {field.points} PTS</span>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>

                                                                                    <div className="pt-1">
                                                                                        <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest block mb-1">Grading Comment</label>
                                                                                        <textarea 
                                                                                            value={grades[resp.id]?.comment || ''}
                                                                                            onChange={e => setGrades({...grades, [resp.id]: {...grades[resp.id], comment: e.target.value}})}
                                                                                            className="w-full bg-bg border border-border rounded p-2.5 text-xs text-text focus:border-accent outline-none transition-colors h-16 resize-none"
                                                                                            placeholder="Add a comment for this response..."
                                                                                        />
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>

                                                            {/* Section-Bound Feedback Thread */}
                                                            <div className="mt-8 pt-6 border-t border-border space-y-4">
                                                                <h5 className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                                                                    <MessageSquare size={12} className="text-accent" />
                                                                    Section Feedback (Visible to Applicant)
                                                                </h5>

                                                                {/* Comments List */}
                                                                <div className="space-y-3">
                                                                    {sectionCommentsList.map((c: any) => (
                                                                        <div key={c.id} className="flex flex-col bg-bg/40 border border-border p-3 rounded-lg max-w-3xl">
                                                                            <div className="flex justify-between items-center mb-1">
                                                                                <span className="text-[10px] font-bold text-accent">
                                                                                    {c.user?.username || 'System'}
                                                                                </span>
                                                                                <span className="text-[9px] text-text-muted">{new Date(c.created_at).toLocaleDateString()}</span>
                                                                            </div>
                                                                            <p className="text-xs text-text-muted whitespace-pre-wrap">{c.comment}</p>
                                                                        </div>
                                                                    ))}

                                                                    {sectionCommentsList.length === 0 && (
                                                                        <div className="text-left py-2 opacity-50 flex items-center gap-2 text-text-muted">
                                                                            <MessageSquare size={16} />
                                                                            <p className="text-[10px] font-bold uppercase">No feedback left on this section yet.</p>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Add Comment Form */}
                                                                <form onSubmit={(e) => handleAddSectionComment(section.id, e)} className="flex items-end gap-3 max-w-3xl pt-2">
                                                                    <div className="flex-1">
                                                                        <textarea
                                                                            value={sectionComments[section.id] || ''}
                                                                            onChange={(e) => setSectionComments(prev => ({ ...prev, [section.id]: e.target.value }))}
                                                                            className="w-full bg-bg border border-border rounded-lg p-3 text-xs text-text focus:border-accent outline-none transition-colors h-16 resize-none"
                                                                            placeholder="Type feedback specifically for this section to share with the applicant..."
                                                                        />
                                                                    </div>
                                                                    <button
                                                                        type="submit"
                                                                        disabled={submittingComment[section.id] || !sectionComments[section.id]?.trim()}
                                                                        className="p-3 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors self-end mb-1"
                                                                        title="Send feedback to applicant"
                                                                    >
                                                                        <Send size={14} />
                                                                    </button>
                                                                </form>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}

                    {Object.keys(grades).length > 0 && (
                        <div className="flex justify-end pt-4">
                            <button 
                                onClick={handleGradeResponses}
                                disabled={grading}
                                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded font-bold uppercase tracking-widest text-xs transition-colors shadow-lg shadow-purple-500/20 disabled:opacity-50"
                            >
                                {grading ? 'Saving Grades...' : 'Save All Grades'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Sidebar: Status & Internal Comments */}
                <div className="w-96 border-l border-border bg-card/50 flex flex-col overflow-hidden">
                    {/* Status Management */}
                    <div className="p-6 border-b border-border">
                        <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Shield size={14} className="text-accent" />
                            Manage Status
                        </h3>
                        <div className="grid grid-cols-1 gap-2">
                            {submission.form?.statuses
                                ?.filter((status: any) => {
                                    if (status.system_key === 'pending') return false;
                                    return !status.stage_ids || status.stage_ids.length === 0 || status.stage_ids.includes(submission.current_stage_id);
                                })
                                .map((status: any) => (
                                    <button 
                                        key={status.id}
                                        onClick={() => handleUpdateStatus(status.id)}
                                        disabled={updatingStatus || submission.current_status_id === status.id}
                                        className={`w-full text-left px-4 py-2.5 rounded border text-xs font-bold uppercase tracking-widest transition-all ${
                                            submission.current_status_id === status.id 
                                            ? 'bg-accent/10 border-accent text-accent' 
                                            : 'bg-bg border-border text-text-muted hover:border-accent/50'
                                        } disabled:opacity-80`}
                                    >
                                        {status.name}
                                    </button>
                                ))}
                        </div>
                        {renderStageActions()}
                    </div>

                    {/* Internal Discussion */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="p-4 bg-bg/30 border-b border-border flex justify-between items-center">
                            <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                                <Lock size={12} className="text-amber-500" />
                                Internal Discussion
                            </h3>
                            <span className="text-[8px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                Reviewers Only
                            </span>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {internalCommentsList.map((c: any) => (
                                <div key={c.id} className="flex flex-col bg-amber-500/5 border border-amber-500/20 p-3 rounded-lg">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[10px] font-bold text-text">{c.user?.username}</span>
                                        <span className="text-[9px] text-text-muted">{new Date(c.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-xs text-text-muted whitespace-pre-wrap">{c.comment}</p>
                                </div>
                            ))}
                            {internalCommentsList.length === 0 && (
                                <div className="text-center py-8 opacity-20 flex flex-col items-center">
                                    <MessageSquare size={32} />
                                    <p className="text-[10px] font-bold uppercase mt-2">No internal discussion yet</p>
                                </div>
                            )}
                        </div>

                        <form onSubmit={handleAddInternalComment} className="p-4 border-t border-border bg-card">
                            <textarea 
                                value={internalComment}
                                onChange={e => setInternalComment(e.target.value)}
                                className="w-full bg-bg border border-border rounded-lg p-2.5 text-xs text-text focus:border-accent outline-none transition-colors h-20 resize-none mb-3"
                                placeholder="Type a comment only reviewers can see..."
                            />
                            <div className="flex items-center justify-end">
                                <button 
                                    type="submit"
                                    disabled={submittingComment.internal || !internalComment.trim()}
                                    className="p-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded disabled:opacity-50 transition-colors"
                                    title="Send internal comment"
                                >
                                    <Send size={14} />
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FormSubmissionReview;
