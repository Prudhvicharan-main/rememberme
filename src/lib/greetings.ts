import { EventCategory } from '@/types';

export interface GreetingTemplate {
  label: string;
  text: string;
}

export function greetingsForCategory(category: EventCategory, name?: string): GreetingTemplate[] {
  const who = name ? name : 'you';
  if (category === 'birthday') {
    return [
      {
        label: 'Simple',
        text: `Happy Birthday${name ? ` ${name}` : ''}! 🎉 Hope you have a wonderful day and an amazing year ahead!`,
      },
      {
        label: 'Friend',
        text: `Happy Birthday${name ? ` ${name}` : ''}! 🎂 Wishing you lots of happiness, success and great memories!`,
      },
      {
        label: 'Warm',
        text: `Wishing ${who} the happiest of birthdays — may this year bring you everything you're hoping for! 🥳`,
      },
    ];
  }
  if (category === 'anniversary' || category === 'wedding') {
    return [
      {
        label: 'Simple',
        text: `Happy Anniversary${name ? ` to ${name}` : ''}! 💍 Wishing you many more years of love and happiness.`,
      },
      {
        label: 'Warm',
        text: `Celebrating you today${name ? `, ${name}` : ''} — here's to more beautiful years together! 🥂`,
      },
    ];
  }
  return [
    {
      label: 'Simple',
      text: `Thinking of you today${name ? `, ${name}` : ''}! 🎉`,
    },
  ];
}
