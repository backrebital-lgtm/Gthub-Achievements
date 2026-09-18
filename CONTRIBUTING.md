# مشارکت

هر PR باید یک بهبود مشخص داشته باشد: یک مثال قابل اجرا، اصلاح مستندات، رفع باگ یا تست کاربردی.

1. Issue موجود را انتخاب کنید یا مسئلهٔ مشخصی را توضیح دهید.
2. شاخه بسازید و تغییر را با حسابی که کار را انجام داده ثبت کنید. مسیر عملی: [مثال branch و PR](docs/examples/branch-pr.fa.md).
3. `npm test`، `npm run check` و `npm run coauthor` را اجرا کنید. مورد آخر قالب `Co-authored-by` را از `git log` محلی می‌سنجد و توکن نمی‌خواهد.
4. PR با توضیح تغییر و نتیجهٔ بررسی‌ها باز کنید. Merge تغییرات را روی `main` می‌نشاند؛ close بدون merge این کار را نمی‌کند.
5. بازبینی‌کننده نتیجهٔ بررسی واقعی خود را ثبت کند؛ merge پس از بررسی تغییر انجام شود.

دو حساب متعلق به یک نفر، دو بازبینی‌کنندهٔ مستقل نیستند. تنها زمانی co-author ثبت کنید که نویسندهٔ دیگر واقعاً در آن commit همکاری کرده باشد. ایمیل co-author باید به حساب GitHub او وصل باشد؛ قالب رسمی `Co-authored-by: NAME <EMAIL>` است. ایمیل noreply برای حفظ حریم خصوصی مناسب است. جزئیات انتساب: [انتساب و Discussions](docs/examples/attribution.fa.md). گردش‌کار `Validate co-authors` قالب را از API همان PR و با کد شاخهٔ پیش‌فرض بررسی می‌کند. با باز شدن PR، از عضو دیگر بررسی خواسته می‌شود؛ روزبه‌روز: [گردش‌کارهای دو حساب](docs/workflows.fa.md).

نقش پیشنهادی ramincsy: مثال‌ها و پیاده‌سازی. نقش پیشنهادی backrebital-lgtm: بررسی اجرای مثال‌ها و اصلاح مستندات. این نقش‌ها صرفاً تقسیم کار هستند، نه دستور تأیید خودکار. مسیر عملی trailer: [Pair Extraordinaire](docs/examples/pair-extraordinaire.fa.md).

برچسب‌ها: `ready-for-work` برای ورود به صف، `blocked` برای توقف واگذاری، `priority:high` / `priority:normal` برای ترتیب، `area:docs` / `area:automation` / `area:tests` برای موضوع.

## چک‌لیست دو حساب

قبل از باز کردن PR غیرپیش‌نویس:

1. مسئله مشخص است و این PR همان کار را حل می‌کند؛ PR باز موازی را تکرار نکنید.
2. `npm test`، `npm run check` و `npm run coauthor` روی آخرین commit موفق‌اند.
3. `Co-authored-by` فقط برای همکاری واقعی در همان commit است. قالب: `Co-authored-by: NAME <ID+login@users.noreply.github.com>`. شناسه را با `gh api users/LOGIN --jq .id` بخوانید و با **Settings → Emails** همان حساب مقایسه کنید.
4. دو حساب [ramincsy](https://github.com/ramincsy) و [backrebital-lgtm](https://github.com/backrebital-lgtm) **یک مالک** دارند. درخواست بررسی بین آن‌ها دو reviewer مستقل نمی‌سازد.
5. گردش‌کار `Request peer review` برای PR غیرپیش‌نویس یکی از دو عضو از عضو دیگر بررسی می‌خواهد. اگر نویسنده `cursor[bot]` یا هویت دیگری است ولی همان PR trailer noreply خوش‌فرم یک عضو دارد، از عضوی که هنوز reviewer نیست بررسی خواسته می‌شود. بدون trailer عضو، برای bot یا نویسندهٔ خارجی درخواست ساخته نمی‌شود. گردش‌کار approve یا merge نمی‌کند.
6. **Quickdraw هدف این پروژه نیست.** Issue یا PR را ظرف حدود ۵ دقیقه پس از باز شدن نبندید تا رویداد نشان ساخته شود. بستن فقط وقتی کار منسوخ یا تکراری است.
7. **YOLO هدف این پروژه نیست.** بدون بررسی واقعی merge نکنید. گردش‌کارها approve یا merge نمی‌کنند.

این چک‌لیست جایگزین بررسی انسانی نیست و Achievement را تضمین نمی‌کند.
