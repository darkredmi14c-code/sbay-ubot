import { User } from '../entities/user.entity';

export function renderMessageTemplate(template: string, user: User): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
  const vars: Record<string, string> = {
    ism: user.firstName ?? '',
    familiya: user.lastName ?? '',
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    fullName: fullName || 'foydalanuvchi',
    username: user.username ? `@${user.username}` : '',
    telefon: user.phone ?? '',
    phone: user.phone ?? '',
    id: user.telegramUserId,
    guruh: user.sourceGroupTitle ?? '',
  };

  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '');
}
