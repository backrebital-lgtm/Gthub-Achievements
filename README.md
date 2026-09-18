# Gthub Achievements

راهنمای فارسی همکاری در GitHub و پیگیری فعالیت‌های واقعی پروژه. نام مخزن با املای `Gthub` ثبت شده و عمداً تغییر داده نمی‌شود.

مجوز: [MIT](LICENSE). گزارش امنیتی: [SECURITY.md](SECURITY.md).

## اعضا

- مالک: [ramincsy](https://github.com/ramincsy)
- همکار: [backrebital-lgtm](https://github.com/backrebital-lgtm)

دو حساب یک مالک دارند. درخواست بررسی بین آن‌ها جایگزین بازبین انسانی مستقل نیست. گردش‌کارها با هویت `github-actions[bot]` اجرا می‌شوند و Achievement را تضمین نمی‌کنند.

## اجرای محلی

به Node.js نسخهٔ ۲۰ یا بالاتر نیاز دارید (CI روی ۲۲ اجرا می‌شود). نصب وابستگی لازم نیست.

```sh
npm test
npm run check
```

## همکاری ساعتی

گردش‌کار `Hourly maintenance` با تغییر Issue یا وضعیت PR، برنامهٔ دقیقهٔ ۱۷ هر ساعت به وقت UTC، و اجرای دستی در تب Actions فعال می‌شود:

1. سلامت فایل‌های راهنما و تست‌های برنامه را بررسی می‌کند.
2. Issueها و PRهای باز همین مخزن را با صفحه‌بندی کامل می‌خواند؛ دادهٔ ناقص را موفق گزارش نمی‌کند.
3. کارهای `ready-for-work` بدون مسئول را متوازن واگذار می‌کند؛ اگر `blocked by` بومی هنوز باز باشد یا برچسب `blocked` باشد واگذار نمی‌کند و بررسی PRها را از عضو دیگر درخواست می‌کند.
4. در صورت وجود کار، یک Issue هماهنگی ایجاد یا به‌روزرسانی می‌کند.
5. اگر وضعیت تغییری نکرده باشد، چیزی منتشر نمی‌کند.

این گردش‌کار یک هماهنگ‌کنندهٔ قطعی است؛ عامل هوش مصنوعی برای تولید کد یا مکالمه نیست. کارهای آن با هویت `github-actions[bot]` انجام می‌شوند و دریافت Achievement را تضمین نمی‌کند.

علاوه بر Actions، یک وظیفهٔ ساعتی در Codex مالک پروژه تنظیم شده است تا کارهای واقعی را پیاده‌سازی، تست و بررسی کند. این وظیفه به روشن‌بودن کامپیوتر، اجرای برنامه، سهمیهٔ در دسترس و نشست معتبر حساب‌ها وابسته است و با clone این مخزن منتقل نمی‌شود. نوشته‌های آن از طرف حساب‌ها با ذکر خودکاربودن منتشر می‌شوند؛ استفاده از دو حساب یک مالک به معنی دو بازبینی‌کنندهٔ انسانی مستقل نیست.

زمان اجرای GitHub Actions ممکن است تأخیر داشته باشد. زمان‌بندی باید روی شاخهٔ پیش‌فرض باشد و در مخزن عمومی پس از ۶۰ روز بی‌فعالیتی ممکن است غیرفعال شود.

## شروع کار

- [راهنمای مشارکت](CONTRIBUTING.md)
- [مثال عملی branch، PR، close و merge](docs/examples/branch-pr.fa.md)
- [انتساب commit، co-author و Discussions](docs/examples/attribution.fa.md)
- [نشان‌ها و محدودیت شواهد](docs/achievements.fa.md)
- [تنظیم همکاری و دسترسی](docs/setup.fa.md)
- [صف کار، بررسی، اولویت‌ها و اجرای آزمایشی](docs/collaboration.fa.md)

## منابع رسمی

- [Achievements در پروفایل](https://docs.github.com/en/account-and-profile/reference/profile-reference)
- [نویسندگی مشترک](https://docs.github.com/en/pull-requests/how-tos/commit-changes/creating-a-commit-with-multiple-authors)
- [زمان‌بندی Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- [هویت GITHUB_TOKEN](https://docs.github.com/en/actions/concepts/security/github_token)
