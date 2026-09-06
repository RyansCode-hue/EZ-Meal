export type Household = {
  id: string;
  name: string;
  invite_code: string;
  week_start_day: number;
  planning_day: number;
  planning_time: string;
  dinner_reminder_time: string;
  units: 'imperial' | 'metric';
  grocery_start: string | null;
  grocery_end: string | null;
  grocery_generated_at: string | null;
};

export type HouseholdMember = {
  household_id: string;
  user_id: string;
  display_name: string;
  remind_planning: boolean;
  remind_dinner: boolean;
  notify_partner: boolean;
};
