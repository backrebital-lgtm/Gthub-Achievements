# گردش‌کارهای دو حساب

اعضا: مالک [ramincsy](https://github.com/ramincsy) و همکار [backrebital-lgtm](https://github.com/backrebital-lgtm). هر دو حساب یک نفرند؛ درخواست بررسی خودکار جایگزین بازبینی انسانی مستقل نیست. هویت `GITHUB_TOKEN` برابر `github-actions[bot]` است و Achievement را تضمین نمی‌کند.

زمان‌بندی Actions ممکن است تأخیر داشته باشد و در مخزن عمومی پس از ۶۰ روز بی‌فعالیتی غیرفعال شود. PAT، کوکی مرورگر و ربات مزرعه‌ای در این پروژه نیست.

## روز کاری ramincsy (پیاده‌سازی)

1. Issue مشخص با معیار پایان را بردارید یا باز کنید؛ پس از برچسب `ready-for-work` هماهنگ‌کننده مسئول را متوازن می‌کند.
2. شاخه بسازید و تغییر واقعی را با **همین حساب** commit کنید.
3. اگر backrebital واقعاً در همان commit کار کرده، trailer رسمی را با **ایمیل متصل به حساب او** بگذارید. جزئیات noreply: [انتساب commit](examples/attribution.fa.md).

   ```text
   Co-authored-by: backrebital-lgtm <EMAIL>
   ```

   ایمیل نمونهٔ مستندات (`NAME@EXAMPLE.COM`) رد می‌شود. ترجیح: noreply گیت‌هاب همان حساب (از Settings → Emails، نه حدس `ID`).
4. PR غیرپیش‌نویس باز کنید. `Request peer review` از backrebital-lgtm بررسی می‌خواهد. `Validate co-authors` قالب trailer را می‌سنجد. `CI` تست و لینک‌ها را اجرا می‌کند (`opened` / `synchronize` / `reopened` / `ready_for_review`).
5. پس از اصلاحات، بررسی همان commit را بگیرید؛ این پروژه برای YOLO بدون review ادغام نمی‌کند. مسیر عملی PR: [مثال branch و PR](examples/branch-pr.fa.md).

## روز کاری backrebital-lgtm (بررسی و مستندات)

1. اعلان بررسی را باز کنید، diff و تست را واقعاً ببینید، و Approve / Request changes / Comment ثبت کنید. تأیید صوری به‌خاطر دو بودن حساب‌ها «دو reviewer مستقل» نمی‌سازد.
2. برای کار مستندات یا تست، PR با این حساب باز کنید؛ گردش‌کار از ramincsy بررسی می‌خواهد.
3. پرسش واقعی را در Discussions دستهٔ **Q&A** با قالب `.github/DISCUSSION_TEMPLATE/q-a.yml` بنویسید یا پاسخ بدهید. پاسخ پذیرفته‌شده را جعل نکنید؛ انتخاب Answer با نویسندهٔ پرسش است. عیب‌یابی: [انتساب و Discussions](examples/attribution.fa.md).

## گردش‌کارها

| گردش‌کار | نقش | چه می‌کند | چه نمی‌کند |
| --- | --- | --- | --- |
| `CI` | سلامت | `npm test` و `npm run check` روی `opened` / `synchronize` / `reopened` / `ready_for_review` | درخواست بررسی، merge |
| `Validate co-authors` | Pair Extraordinaire (قالب) | روی PR، trailerهای `Co-authored-by` را می‌سنجد | ایمیل را به حساب وصل نمی‌کند؛ trailer نمی‌سازد |
| `Request peer review` | بررسی متقابل | با باز شدن PR غیرپیش‌نویس یکی از دو عضو، از عضو دیگر بررسی می‌خواهد؛ **کد شاخهٔ پیش‌فرض** را اجرا می‌کند | approve، merge، تکرار درخواست موجود، اجرای کد PR |
| `Hourly maintenance` | هماهنگی صف | واگذاری کار آماده، درخواست بررسی جاافتاده، به‌روزرسانی Issue وضعیت پس از تغییر صف یا ثبت/کنارگذاشتن review | کد نمی‌نویسد؛ PR خالی نمی‌سازد؛ merge نمی‌کند؛ review فقط-کامنت را اجرا نمی‌کند |
| `Collaboration progress report` | پیگیری Pull Shark | با اجرا دستی یا دوشنبهٔ هفته (۰۳:۴۷ UTC) PRهای mergeشده را می‌شمارد و در Summary می‌نویسد | Issue/PR نمی‌سازد؛ نشان را تأیید نمی‌کند |

`Hourly maintenance` را تغییر ندهید مگر برای هماهنگی صف. اجرای آزمایشی: Actions → Hourly maintenance → Run workflow با `dry_run` روشن.

گزارش پیشرفت: Actions → Collaboration progress report → Run workflow. فقط Summary را بخوانید.

## Discussions (Galaxy Brain)

این مخزن Discussions دارد. قالب دستهٔ Q&A با slug `q-a` در `.github/DISCUSSION_TEMPLATE/q-a.yml` است. فعال‌سازی اولیهٔ Discussions از فایل مخزن ممکن نیست؛ اگر دسته نباشد، در Settings آن را بسازید. پرسش نمایشی برای نشان نفرستید.

## توقف

از Actions هر گردش‌کار را Disable کنید. هماهنگی ساعتی و گزارش پیشرفت جدا از وظیفهٔ محلی Codex هستند. جزئیات دسترسی: [setup.fa.md](setup.fa.md). محدودیت نشان‌ها: [achievements.fa.md](achievements.fa.md).
