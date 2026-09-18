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
4. PR غیرپیش‌نویس باز کنید. `Request peer review` از عضو دیگر بررسی می‌خواهد؛ اگر نویسنده عامل (`cursor[bot]`) است و commit همان PR trailer noreply خوش‌فرم یک عضو دارد، از عضوی که هنوز reviewer نیست درخواست می‌شود. `Validate co-authors` قالب trailer را می‌سنجد. `CI` تست و لینک‌ها را اجرا می‌کند (`opened` / `synchronize` / `reopened` / `ready_for_review`).
5. پس از اصلاحات، بررسی همان commit را بگیرید؛ این پروژه برای YOLO بدون review ادغام نمی‌کند. مسیر عملی PR: [مثال branch و PR](examples/branch-pr.fa.md).

## روز کاری backrebital-lgtm (بررسی و مستندات)

1. اعلان بررسی را باز کنید، diff و تست را واقعاً ببینید، و Approve / Request changes / Comment ثبت کنید. تأیید صوری به‌خاطر دو بودن حساب‌ها «دو reviewer مستقل» نمی‌سازد.
2. برای کار مستندات یا تست، PR با این حساب باز کنید؛ گردش‌کار از ramincsy بررسی می‌خواهد.
3. پرسش واقعی را در Discussions دستهٔ **Q&A** با قالب `.github/DISCUSSION_TEMPLATE/q-a.yml` بنویسید یا پاسخ بدهید. پاسخ پذیرفته‌شده را جعل نکنید؛ انتخاب Answer با نویسندهٔ پرسش است. عیب‌یابی: [انتساب و Discussions](examples/attribution.fa.md).

## گردش‌کارها

| گردش‌کار | نقش | چه می‌کند | چه نمی‌کند |
| --- | --- | --- | --- |
| `CI` | سلامت | `npm test` و `npm run check` روی `opened` / `synchronize` / `reopened` / `ready_for_review`؛ **کد همان PR** را بدون `GH_TOKEN` اجرا می‌کند | درخواست بررسی، merge |
| `Validate co-authors` | Pair Extraordinaire (قالب) | trailerهای `Co-authored-by` را از API همان PR می‌خواند و با **کد شاخهٔ پیش‌فرض** می‌سنجد | ایمیل را به حساب وصل نمی‌کند؛ trailer نمی‌سازد؛ کد PR را اجرا نمی‌کند |
| `Request peer review` | بررسی متقابل | با PR غیرپیش‌نویس یکی از دو عضو، از عضو دیگر بررسی می‌خواهد؛ اگر نویسنده عضو نیست ولی trailer noreply خوش‌فرم یک عضو روی commit همان PR هست، از عضوی که هنوز reviewer نیست درخواست می‌شود؛ **کد شاخهٔ پیش‌فرض** را اجرا می‌کند | approve، merge، تکرار درخواست موجود، درخواست برای bot/خارجی بدون trailer عضو، اجرای کد PR |
| `Hourly maintenance` | هماهنگی صف | واگذاری کار آماده، درخواست بررسی جاافتاده، به‌روزرسانی Issue وضعیت پس از تغییر صف یا ثبت/کنارگذاشتن review | کد نمی‌نویسد؛ PR خالی نمی‌سازد؛ merge نمی‌کند؛ review فقط-کامنت را اجرا نمی‌کند |
| `Collaboration progress report` | پیگیری Pull Shark و pair | با اجرا دستی یا دوشنبهٔ هفته (۰۳:۴۷ UTC) PRهای mergeشدهٔ **عضو-نویسنده** و trailerهای خوش‌فرم روی commit **نشسته روی شاخهٔ پیش‌فرض** را می‌شمارد (squash: همان merge commit؛ merge: commitهای غیر-merge). **کد شاخهٔ پیش‌فرض** را اجرا می‌کند | Issue/PR نمی‌سازد؛ نشان را تأیید نمی‌کند؛ trailer بازنویسی‌شدهٔ squash را از روی شاخهٔ PR حدس نمی‌زند؛ شاخهٔ انتخاب‌شده در `workflow_dispatch` را اجرا نمی‌کند |

`Hourly maintenance` را تغییر ندهید مگر برای هماهنگی صف. اجرای آزمایشی: Actions → Hourly maintenance → Run workflow با `dry_run` روشن.

تغییر `scripts/coauthor.mjs` در یک PR را `CI` با کد همان PR آزمایش می‌کند؛ گردش‌کار `Validate co-authors` تا ادغام، نسخهٔ شاخهٔ پیش‌فرض را با توکن می‌خواند. این جداسازی عمدی است تا PR نتواند اعتبارسنجی را تضعیف کند.

گزارش پیشرفت: Actions → Collaboration progress report → Run workflow. فقط Summary را بخوانید. مسیر عملی trailer: [مثال Pair Extraordinaire](examples/pair-extraordinaire.fa.md).

## Discussions (Galaxy Brain)

این مخزن Discussions دارد. قالب دستهٔ Q&A با slug `q-a` در `.github/DISCUSSION_TEMPLATE/q-a.yml` است. فعال‌سازی اولیهٔ Discussions از فایل مخزن ممکن نیست؛ اگر دسته نباشد، در Settings آن را بسازید. پرسش نمایشی برای نشان نفرستید.

## Quickdraw و YOLO

گردش‌کارها Issue/PR را برای ساختن رویداد زمانی نمی‌بندند و approve/merge نمی‌کنند.

- **Quickdraw:** بستن ظرف حدود ۵ دقیقه پس از باز شدن هدف نیست و خودکارسازی نمی‌شود.
- **YOLO:** merge بدون بررسی هدف نیست؛ پس از اصلاحات، بررسی همان commit را بگیرید.

قالب trailer را می‌توانید پیش از push با `npm run coauthor` از `git log` محلی بسنجید. آن دستور توکن ندارد. گردش‌کار `Validate co-authors` همچنان از API PR و کد شاخهٔ پیش‌فرض استفاده می‌کند.

## توقف

از Actions هر گردش‌کار را Disable کنید. هماهنگی ساعتی و گزارش پیشرفت جدا از وظیفهٔ محلی Codex هستند. جزئیات دسترسی: [setup.fa.md](setup.fa.md). محدودیت نشان‌ها: [achievements.fa.md](achievements.fa.md).
