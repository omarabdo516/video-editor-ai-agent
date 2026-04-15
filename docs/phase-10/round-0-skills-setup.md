# Round 0: Skills Setup + قراءة الخطة

## الهدف
تثبيت الـ Design Skills وقراءة خطة الـ Enhancements الكاملة.

## المهام

### مهمة 1: اقرأ الخطة
1. اقرأ `docs/phase-10/README.md` — الـ overview
2. اقرأ كل ملفات `docs/phase-10/round-*.md` — افهم الـ 17 feature
3. اقرأ `docs/design-system.md` — خصوصاً قسم Motion Intensity و Animation Quality Rules

### مهمة 2: ثبّت الـ Design Skills

```bash
# 1. Anthropic Frontend Design — تصميم مش generic
claude plugin add anthropic/frontend-design

# 2. Motion Design — spring physics + easing curves
npx skills add motion-design-ui-animation

# 3. Taste Skill — motion intensity (1-10) + visual density (1-10)
npx skills add https://github.com/Leonxlnx/taste-skill

# 4. UI/UX Pro Max — 50+ styles + 97 palettes + design system generator
npx skills add https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
```

### مهمة 3: تأكد

```bash
ls .claude/skills/
# لازم يكون فيه: remotion + frontend-design + motion-design + taste + ui-ux-pro-max
```

### مهمة 4: ردّ بالتقرير

```
✅ Skills مثبّتة: [عدد]
📋 Features مفهومة: 17 feature في 7 جولات
⚠️ تعارضات: [لو فيه]
📋 جاهز للجولة 1؟
```

## Success Criteria
- [ ] كل الـ Skills مثبّتة
- [ ] قرأت كل ملفات الخطة
- [ ] مفيش تعارضات مع الكود الحالي
