# مثال عملی branch و pull request

این راهنما یک مسیر قابل تکرار برای ساخت شاخه، ثبت commit، بازکردن PR و تشخیص **merge** از **close** است. دستورات بخش آزمایش محلی روی یک مخزن موقت اجرا می‌شوند و به حساب GitHub یا Achievement وابسته نیستند.

دو حساب [ramincsy](https://github.com/ramincsy) و [backrebital-lgtm](https://github.com/backrebital-lgtm) یک مالک دارند؛ بازکردن PR توسط یکی و بررسی توسط دیگری به‌معنی دو بازبین انسانی مستقل نیست.

## پیش‌نیاز

- Git و Node.js ۲۰ یا بالاتر
- از ریشهٔ همین مخزن: `npm test` و `npm run check`

## آزمایش محلی (بدون GitHub)

اسکریپت زیر یک مخزن موقت می‌سازد، تغییر را روی شاخهٔ کاری commit می‌کند، آن را با merge روی `main` فرود می‌آورد، سپس نشان می‌دهد بستن بدون merge فایل را به شاخهٔ اصلی نمی‌برد.

<!-- runnable:local-pr -->
```sh
set -euo pipefail
ROOT=${ROOT:-$(mktemp -d)}
cd "$ROOT"
git init -b main
git config user.name "Practice"
git config user.email "practice@users.noreply.github.com"
printf '%s\n' '# practice' > README.md
git add README.md
git commit -m "docs: start practice repository"
git checkout -b docs/practice-example
printf '%s\n' 'example' > docs-example.txt
git add docs-example.txt
git commit -m "docs: add a verifiable example file"
git checkout main
git merge --no-ff docs/practice-example -m "merge: land the example on main"
test -f docs-example.txt
git checkout -b docs/unmerged-close
printf '%s\n' 'closed without merge' > closed.txt
git add closed.txt
git commit -m "docs: this change is not on main"
git checkout main
test ! -f closed.txt
git rev-parse --verify main
git merge-base --is-ancestor docs/practice-example main
if git merge-base --is-ancestor docs/unmerged-close main; then
  echo 'unmerged branch should not be an ancestor of main' >&2
  exit 1
fi
echo "OK $ROOT"
```
<!-- /runnable:local-pr -->

معیار پایان همین آزمایش: فایل `docs-example.txt` روی `main` هست و `closed.txt` نیست.

## مسیر واقعی روی GitHub

جایگزین‌ها را با شمارهٔ Issue واقعی عوض کنید. شاخه را از `main` به‌روز بسازید.

```sh
git checkout main
git pull origin main
git checkout -b docs/issue-3-branch-pr
# تغییر مرتبط را اعمال کنید
git add docs/examples/branch-pr.fa.md
git commit -m "docs: add a reproducible branch and pull request tutorial"
git push -u origin HEAD
```

سپس در GitHub یک PR غیرپیش‌نویس به `main` باز کنید، توضیح تغییر و نتیجهٔ `npm test` / `npm run check` را بنویسید، و Issue مرتبط را ذکر کنید. هماهنگ‌کننده در صورت ظرفیت، از حساب دیگر درخواست بررسی می‌کند. هویت Actions برابر با فعالیت شخصی ramincsy یا backrebital-lgtm نیست.

### تفاوت close و merge

| عمل | اثر روی `main` | اثر معمول روی Pull Shark |
| --- | --- | --- |
| **Merge** (merge commit، squash یا rebase که تغییرات را فرود بیاورد) | commitهای پذیرفته‌شده روی شاخهٔ پیش‌فرض قرار می‌گیرند | فقط PRهایی که **همین حساب** باز کرده و **merge** شده‌اند ممکن است شمرده شوند؛ تضمینی نیست |
| **Close بدون merge** | تغییرات روی `main` نمی‌آیند | بسته شدن بدون merge معمولاً کافی نیست؛ باز و بستن خالی هدف این پروژه نیست |
| **Reopen** | همان PR و همان diff؛ هنوز merge نشده | تا وقتی merge نشود، فرود کار محسوب نمی‌شود |

اگر کار منسوخ است، PR را بدون merge ببندید و دلیل را در همان PR بنویسید. برای ادامهٔ کار همان شاخه را به‌روز کنید یا PR را reopen کنید؛ برای موضوع جدید، Issue و شاخهٔ جدید بسازید.

Close کردن برای خالی‌کردن صف یا تولید رویداد Achievement انجام نشود. **Quickdraw** (بستن ظرف حدود ۵ دقیقه) هدف این مثال نیست. **YOLO** (merge بدون بررسی) هم هدف نیست؛ روی GitHub پس از بررسی واقعی merge کنید.

## بررسی نتیجه

1. `npm test` و `npm run check` روی آخرین commit سبز باشند.
2. در PR، diff همان فایل‌های مرتبط باشد.
3. پس از merge، Issue را با لینک PR ببندید یا معیار پایان را ثبت کنید.
4. اگر PR را close کردید، تأیید کنید تغییر روی `main` نیست (`git fetch` و مقایسه با `origin/main`).

## منابع

- [ایجاد pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request)
- [ادغام pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/merging-a-pull-request)
- [بستن pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/closing-a-pull-request)
- [نشان‌ها و محدودیت شواهد](../achievements.fa.md)
