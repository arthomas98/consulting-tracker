export interface TimeEntry {
  id: string;
  companyId: string;
  projectId?: string;
  date: string;
  hours: number;
  fixedAmount?: number;
  description: string;
  paidDate?: string;
  createdAt: string;
  updatedAt: string;
}
