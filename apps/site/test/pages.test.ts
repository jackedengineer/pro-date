import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (name: string) =>
  readFileSync(resolve(import.meta.dirname, '../public', name), 'utf8');
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const contact = 'trainwithchirag@gmail.com';
const pages = ['index', 'privacy', 'terms', 'safety', 'delete-account', 'support'];

describe('public pages', () => {
  it.each(pages)('%s names the app, gives a contact and has no placeholders', (page) => {
    const html = read(`${page}.html`);

    expect(html).toContain('<html lang="en">');
    expect(html).toContain('Merge');
    expect(html).toContain(`mailto:${contact}`);
    expect(text(html)).not.toMatch(/lorem|todo|tbd|example\.com|\[.*?\]|your company/i);
  });

  it('loads nothing from a third party, so reading a policy shares no data', () => {
    for (const page of pages) {
      const sources = [...read(`${page}.html`).matchAll(/(?:src|href)="(https?:[^"]+)"/g)];
      expect(sources).toEqual([]);
    }
    expect(read('styles.css')).not.toMatch(/@import|url\(/);
  });

  it('gives Google Play what its account-deletion link must show', () => {
    const page = text(read('delete-account.html'));

    // The app and developer, the steps, what is deleted, what is kept and for how long.
    expect(page).toContain('Merge by jackedengineer');
    expect(page).toMatch(/Profile tab.*Delete account/);
    expect(page).toContain('What is deleted');
    expect(page).toContain('What is kept');
    expect(page).toMatch(/within 30 days/);
  });

  it('publishes child safety standards with a way to report and a named contact', () => {
    const page = text(read('safety.html'));

    expect(page).toMatch(/child sexual abuse and exploitation/i);
    expect(page).toContain('Report or block');
    expect(page).toContain('Child safety contact');
    expect(page).toMatch(/18 and over/);
  });

  it('says the same things the app does about data', () => {
    const page = text(read('privacy.html'));

    for (const processor of ['Clerk', 'Neon', 'Cloudinary', 'Cloudflare', 'Expo'])
      expect(page).toContain(processor);
    expect(page).toMatch(/do not sell/i);
    expect(page).toMatch(/about one kilometre/);
    expect(page).toMatch(/18 and over/);
  });
});
