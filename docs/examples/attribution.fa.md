# انتساب commit، co-author و پاسخ Discussions

این صفحه عیب‌یابی انتساب واقعی است، نه دستور تولید نشان. [Pair Extraordinaire](https://docs.github.com/en/account-and-profile/reference/profile-reference) و [Galaxy Brain](https://docs.github.com/en/account-and-profile/reference/profile-reference) به پردازش GitHub وابسته‌اند و با شمارش trailer یا پاسخ تضمین نمی‌شوند.

دو حساب [ramincsy](https://github.com/ramincsy) و [backrebital-lgtm](https://github.com/backrebital-lgtm) یک مالک دارند. ثبت هر دو نام روی یک commit یا پرسش و پاسخ بین آن‌ها همکاری دو انسان مستقل نیست و هدف این پروژه ساختن سؤال/پاسخ نمایشی برای نشان نیست.

## ایمیل حساب و noreply

GitHub commit را به کاربری پیوند می‌دهد که **ایمیل نویسنده با یکی از ایمیل‌های همان حساب** یکی باشد.

1. در GitHub: **Settings → Emails**.
2. اگر «Keep my email addresses private» روشن است، نشانی `noreply` همان صفحه را برای `user.email` استفاده کنید. شکل رایج:
   - `ID+USERNAME@users.noreply.github.com`
   - یا در حساب‌های قدیمی‌تر: `USERNAME@users.noreply.github.com`
3. `ID` را حدس نزنید. شناسهٔ عددی عمومی را با `gh api users/LOGIN --jq .id` بخوانید، سپس با noreply نمایش‌داده‌شده در Settings مقایسه کنید. مثال عملی با مقادیر تأییدشدهٔ همین دو حساب: [Pair Extraordinaire و noreply](pair-extraordinaire.fa.md).
4. ایمیل را در commit، log یا Issueهای عمومی اگر لازم نیست تکرار نکنید؛ شکل noreply برای همین است.

بررسی محلی هویت نویسنده (بدون هل دادن):

```sh
git log -1 --format='%an <%ae>'
git config --get user.email
```

اگر نام یا ایمیل با حساب هدف نمی‌خواند، commit را با هویت درست **amend** کنید فقط وقتی هنوز push عمومی نشده یا تیم روی بازنویسی توافق دارد. پس از push مشترک، amend را بی‌هماهنگی انجام ندهید.

## co-author واقعی

Trailer فقط وقتی اضافه شود که نفر دیگر **در همان commit** کار کرده باشد. کپی‌کردن نام دوم برای پر کردن گزارش یا شبیه‌سازی Pair Extraordinaire ممنوع است.

شکل مورد انتظار در انتهای پیام commit:

<!-- sample:co-author -->
```
docs: explain how co-author trailers are attributed

Co-authored-by: backrebital-lgtm <329678572+backrebital-lgtm@users.noreply.github.com>
```
<!-- /sample:co-author -->

قواعد:

- یک خط خالی بین بدنهٔ پیام و trailerها مطابق قرارداد git توصیه می‌شود.
- `Co-authored-by:` با همین املا (حساس به بزرگی حروف در عمل رایج GitHub) در ابتدای خط باشد.
- نام نمایشی و ایمیل باید به حساب همکار واقعی اشاره کنند؛ ایمیل noreply همان حساب را از Settings بردارید.
- چند همکار = چند خط `Co-authored-by`.
- squash merge پیام نهایی را بازنویسی می‌کند؛ اگر trailer لازم است باید در پیام squash/merge باقی بماند. در این مخزن squash دیده شد که ادغام‌کننده نویسندهٔ `main` می‌شود و trailer خود را حذف می‌کند.

نمونهٔ ثبت محلی پس از ویرایش واقعی مشترک (اگر Settings نشانی دیگری نشان داد، همان را بگذارید):

```sh
git commit -m "$(cat <<'EOF'
docs: explain how co-author trailers are attributed

Co-authored-by: backrebital-lgtm <329678572+backrebital-lgtm@users.noreply.github.com>
EOF
)"
```

### اگر نام روی پروفایل دیده نمی‌شود

| نشانه | علت رایج | کار درست |
| --- | --- | --- |
| commit روی پروفایل نیست | ایمیل نویسنده در حساب نیست یا commit در fork/شاخهٔ غیرمرتبط است | ایمیل Settings را با `git log` مقایسه کنید |
| co-author لینک نمی‌شود | ایمیل trailer متعلق به آن حساب نیست یا `ID` اشتباه است | noreply نمایش‌داده‌شده در Settings را عیناً بگذارید |
| پس از squash ناپدید شد | ادغام‌کننده نویسنده شد یا پیام merge trailer را حذف کرد | پیام squash را ویرایش و trailer را نگه دارید؛ گزارش پیشرفت pair همان commit نشسته‌روی `main` را می‌شمارد |
| دو حساب یک مالک به‌عنوان دو نفر دیده می‌شوند | GitHub کاربرها را با شناسه جدا می‌کند | در مستندات پروژه افشا کنید؛ این را بررسی مستقل ننامید و برای نشان‌سازی تکرار نکنید |

## Discussions از نوع Q&A

Galaxy Brain به پاسخ درست در Discussions دستهٔ **Q&A** که به‌عنوان Answer انتخاب شود مربوط است. هدف اولیهٔ گزارش‌شده در منابع غیررسمی ۲ پاسخ پذیرفته‌شده است؛ این عدد تضمین رسمی نیست.

- سؤال فقط برای ابهام واقعی همان کار یا مثال باز شود.
- پاسخ باید قابل آزمایش باشد (دستور، خروجی، لینک مستند).
- Answer را فقط وقتی انتخاب کنید که مسئله را حل کند.
- پرسش و پاسخ ساختگی، خودپرسش‌خودپاسخ برای نشان، یا پذیرش پاسخ نادرست انجام نشود.
- این مخزن Discussions دارد؛ الزامی به بازکردن بحث نمایشی نیست.

## محدودیت شواهد Achievement

رویداد قابل مشاهده ≠ نشان. جزئیات محاسبه در public preview کامل منتشر نشده است. Actions با هویت `github-actions[bot]` فعالیت شخصی ramincsy یا backrebital-lgtm شمرده نمی‌شود. هیچ PAT یا کوکی مرورگر برای «شبیه‌سازی انسان» در این پروژه ذخیره یا استفاده نمی‌شود.

## منابع رسمی بررسی‌شده

- [نویسندگی مشترک](https://docs.github.com/en/pull-requests/how-tos/commit-changes/creating-a-commit-with-multiple-authors)
- [تنظیم ایمیل commit](https://docs.github.com/en/account-and-profile/how-tos/setting-up-and-managing-your-personal-account-on-github/managing-email-preferences/setting-your-commit-email-address)
- [مرجع ایمیل و نشانی noreply](https://docs.github.com/en/account-and-profile/reference/email-addresses-reference)
- [انتخاب پاسخ در Discussions](https://docs.github.com/en/discussions/managing-discussions-for-your-community/moderating-discussions)
- [مرجع نشان‌های پروفایل](https://docs.github.com/en/account-and-profile/reference/profile-reference)
- [محدودیت شواهد همین پروژه](../achievements.fa.md)
