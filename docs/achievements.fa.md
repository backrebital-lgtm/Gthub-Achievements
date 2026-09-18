# نشان‌های GitHub

GitHub رویدادهای واجد شرایط را به Achievement تبدیل می‌کند. طبق [مرجع رسمی پروفایل](https://docs.github.com/en/account-and-profile/reference/profile-reference) این قابلیت در **public preview** است، ممکن است تغییر کند، و GitHub **فهرست کامل شرایط بازشدن نشان‌ها را منتشر نکرده است**. شمارش رویداد در این مخزن، تضمین دریافت نشان نیست.

دو حساب این پروژه یک مالک دارند. همکاری واقعی است؛ بازبینی مستقل انسانی نیست. گردش‌کارها PR خالی، ستارهٔ ساختگی، پاسخ نمایشی یا PAT نمی‌سازند.

## جدول مسیرها

آستانه‌های چندسطحی از گزارش‌های جامعه است، نه مستند رسمی GitHub. اگر منبع «جامعه» باشد، رفتار فعلی ممکن است فرق داشته باشد.

| نشان | منبع اطمینان | رویداد مرتبط (خلاصه) | آستانهٔ گزارش جامعه | مسیر این مخزن | خارج از محدوده |
| --- | --- | --- | --- | --- | --- |
| Pull Shark | جامعه (وجود نشان: پیش‌نمایش رسمی) | PRهایی که **همان حساب باز کرده** و **merge** شده‌اند | حدود ۲ / ۱۶ / ۱۲۸ / ۱۰۲۴ | کار واقعی، PR با توضیح، merge پس از بررسی؛ گزارش پیشرفت فقط می‌شمارد | باز و بستن بدون merge؛ PR تهی |
| Pair Extraordinaire | جامعه + قالب رسمی `Co-authored-by` | trailer با **ایمیل متصل به حساب** همکار؛ commit از طریق **PR ادغام‌شده به شاخهٔ پیش‌فرض** | حدود ۱ / ۱۰ / ۲۴ / ۴۸ | همکاری واقعی در همان commit؛ اعتبارسنجی قالب؛ شمارش commit **نشسته روی main** (squash ممکن است trailer را بازنویسی کند) | ثبت نام دوم برای یک نفر؛ ایمیل نمونه (`example.com`) |
| Quickdraw | جامعه | بستن Issue یا PR ظرف حدود ۵ دقیقه پس از باز شدن | گزارش نشده | مستند شده؛ خودکارسازی نمی‌شود | بستن فوری برای نشان |
| YOLO | جامعه | merge **بدون review** | گزارش نشده | این پروژه بررسی می‌خواهد؛ گردش‌کار approve/merge نمی‌کند | merge بدون نگاه برای نشان |
| Galaxy Brain | جامعه | پاسخ پذیرفته‌شده در Discussions از نوع **Q&A** | حدود ۲ / ۸ / ۱۶ / ۳۲ | قالب پرسش واقعی؛ پاسخ نمایشی ساخته نمی‌شود. بحث‌های سازمان Community ممکن است محدود باشد | پرسش و پاسخ ساختگی |
| Starstruck | جامعه | حدود ۱۶ ستاره روی مخزنی که حساب ساخته | حدود ۱۶ (شروع) | کیفیت عمومی مخزن | ستارهٔ حساب دوم به‌تنهایی؛ ربات ستاره |
| Public Sponsor | جامعه / محصول Sponsors | حمایت **عمومی** از طریق GitHub Sponsors | — | این پروژه پرداختی انجام نمی‌دهد | — |
| Mars 2020 Helicopter Contributor | رسمی (پایان‌یافته) | commit در فهرست مخازن اعلام‌شدهٔ GitHub برای مأموریت | غیرقابل دریافت | — | بازسازی با فعالیت جدید |
| Arctic Code Vault Contributor | تاریخی | بایگانی ۲۰۲۰ برنامهٔ Archive | غیرقابل دریافت | — | بازسازی با فعالیت جدید |

Heart On Your Sleeve و Open Sourcerer هدف قطعی این پروژه نیستند؛ راه دریافت عمومی و قابل اتکا در منابع رسمی بررسی‌شده تأیید نشده است.

## Quickdraw و YOLO

این دو نشان در جدول بالا از گزارش جامعه آمده‌اند، نه از کاتالوگ رسمی GitHub. این مخزن آن‌ها را **خودکارسازی نمی‌کند** و برای گرفتن نشان رویداد نمی‌سازد.

- **Quickdraw:** گزارش جامعه می‌گوید بستن Issue یا PR ظرف حدود ۵ دقیقه پس از باز شدن ممکن است شمرده شود. هماهنگ‌کننده Issue/PR نمی‌بندد. بستن فوری برای نشان انجام نشود؛ فقط کار منسوخ یا تکراری را با دلیل ببندید.
- **YOLO:** گزارش جامعه می‌گوید merge **بدون review**. گردش‌کارهای این پروژه approve یا merge نمی‌کنند و پس از بررسی واقعی ادغام می‌خواهند. merge بدون نگاه برای نشان خارج از محدوده است.

رویداد قابل مشاهده ≠ نشان. `GITHUB_TOKEN` هویت `github-actions[bot]` است و Achievement شخصی ramincsy یا backrebital-lgtm نیست.

## قالب نویسندگی مشترک

طبق [مستند رسمی co-author](https://docs.github.com/en/pull-requests/how-tos/commit-changes/creating-a-commit-with-multiple-authors)، برای انتساب commit به نفر دوم، در پیام commit (پس از یک خط خالی) بنویسید:

```text
Co-authored-by: NAME <EMAIL>
```

ایمیل باید به حساب GitHub همان همکار وصل باشد. اگر ایمیل خصوصی است، از نشانی noreply گیت‌هاب استفاده کنید (`username@users.noreply.github.com` یا `ID+username@users.noreply.github.com`). گردش‌کار `Validate co-authors` فقط **قالب** را بررسی می‌کند؛ اتصال ایمیل به حساب را GitHub انجام می‌دهد.

## ضدهرزنامه

- PR، Issue، Discussion یا ستاره برای خالی نبودن گزارش یا افزایش شمارنده نسازید.
- `Co-authored-by` را فقط وقتی بگذارید که نفر دیگر واقعاً در همان commit کار کرده باشد.
- پاسخ Q&A را از پیش «پذیرفته» جعل نکنید؛ انتخاب Answer با نویسندهٔ پرسش است.
- PAT، کوکی مرورگر و ربات مزرعه‌ای نشان بخشی از این پروژه نیستند.

## شواهد

جزئیات عملی انتساب و Q&A: [عیب‌یابی co-author و Discussions](examples/attribution.fa.md). مثال trailer با شناسهٔ تأییدشده: [Pair Extraordinaire](examples/pair-extraordinaire.fa.md). گزارش پیشرفت commit نشسته‌روی شاخهٔ پیش‌فرض را می‌شمارد. گردش‌کارها: [workflows.fa.md](workflows.fa.md).

- [مرجع رسمی پروفایل و Achievements](https://docs.github.com/en/account-and-profile/reference/profile-reference) — پیش‌نمایش عمومی؛ بدون کاتالوگ کامل.
- [نویسندگی مشترک](https://docs.github.com/en/pull-requests/how-tos/commit-changes/creating-a-commit-with-multiple-authors)
- [انتخاب پاسخ در Discussions](https://docs.github.com/en/discussions/managing-discussions-for-your-community/moderating-discussions)
- [پژوهش تجربی دربارهٔ نشان‌ها، ۲۰۲۴](https://ricerca.uniba.it/bitstream/11586/502580/2/1-s2.0-S0950584924001666-main.pdf) — شواهد تاریخی، نه تضمین رفتار فعلی.
