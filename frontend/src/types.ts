export type Signal = { month: number; meetups: number; calls: number; avg_call_duration_min: number; texts_per_week: number };
export type Score = { month: number; z_meetups: number; z_calls: number; z_texts: number; combined_weighted_z: number };
export type Flag = { type: "decay" | "rise_existing" | "rise_cold_start" | "none"; fired: boolean; month_fired: number | null; trigger_signal: string | null; window_used: number[] | null };
export type Baseline = { window_months: number[]; meetups_baseline: number | null; calls_baseline: number | null; avg_call_duration_min_baseline: number | null; texts_per_week_baseline: number | null };
export type SourceMonth = { label: string; texts_per_week?: number; meetup_count?: number };
export type SourceData = { whatsapp?: SourceMonth[]; calendar?: SourceMonth[] };
export type Contact = { contact_id: string; name: string; archetype: string; monthly_signals: Signal[]; detection: { baseline: Baseline; monthly_scores: Score[]; flag: Flag }; insight: string | null; data_source?: "whatsapp" | "calendar" | "combined"; source_email?: string; source_data?: SourceData; month_labels?: string[] };
export type DemoData = { contacts: Contact[] };
