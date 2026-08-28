import { EventCategory } from '@/types';

/** Returns 2-4 short actionable suggestions for a given event category. */
export function suggestionsForCategory(category: EventCategory): string[] {
  switch (category) {
    case 'birthday':
      return ['Send a greeting', 'Call them', 'Buy a gift', 'Plan a celebration'];
    case 'anniversary':
    case 'wedding':
      return ['Send wishes', 'Call them', 'Plan dinner', 'Prepare a greeting', 'Buy a gift'];
    case 'meeting':
      return ['Review notes', 'Prepare documents', 'Prepare questions', 'Set an additional reminder'];
    case 'task':
    case 'work':
    case 'college':
      return ['Start the task', 'Break it into smaller steps', 'Set a preparation reminder'];
    case 'exam':
      return ['Review your notes', 'Make a study plan', 'Get everything ready the night before'];
    case 'payment':
      return ['Check the amount due', 'Set aside funds', 'Confirm payment method'];
    case 'appointment':
      return ['Confirm the appointment', 'Prepare questions', 'Set travel time reminder'];
    default:
      return ['Add a note', 'Set a reminder', 'Add to checklist'];
  }
}
