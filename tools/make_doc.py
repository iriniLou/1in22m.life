"""
Собирает Word-файл со всеми историями и ветками игры «1 из 22 миллионов»
прямо из файлов js/stories-*.js и js/content.js — документ всегда совпадает с игрой.

Запуск (из папки 1in22m):  python tools/make_doc.py
Нужен python-docx:          pip install python-docx
"""
import json
import pathlib
import re

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor, Cm

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "1_из_22_миллионов_все_ветки.docx"

ACCENT = RGBColor(0x1D, 0x4E, 0xD8)
DIM = RGBColor(0x6B, 0x6B, 0x73)
ERA_NAMES = {"past": "Прошлое (2004–2010)", "present": "Настоящее (2025–2026)", "future": "Ближайшее будущее (2031–2036)"}
STAT_NAMES = {"f": "друзья рядом", "t": "доверие к взрослым", "c": "уверенность", "d": "цифровая грамотность"}
TILT_NAMES = {"study": "📚 Учёба", "friends": "🫶 Друзья", "create": "🎨 Творчество", "sport": "⚽ Спорт", "games": "🎮 Игры и техника"}

# Пример подстановок для чтения (в игре всё выпадает случайно; для колледжа слова меняются на «группа», «куратор» и т. д.)
SAMPLE = {
    "name": "Саша", "friend": "Женя", "year": "2026", "age": "14", "region": "Тульская область",
    "in_region": "в Тульской области", "city": "Тула", "spec": "Сварочное производство",
    "mentor": "Анна Сергеевна", "mentor_dat": "Анне Сергеевне", "mentor_acc": "Анну Сергеевну", "mentor_ins": "Анной Сергеевной",
    "grade": "8 «Б» класс", "school": "школа", "school_cap": "Школа", "in_school": "в школе", "in_school_cap": "В школе",
    "school_gen": "школы", "to_school": "в школу", "mates": "одноклассники", "mates_dat": "одноклассникам",
    "mates_gen": "одноклассников", "in_class": "в классе", "in_class_cap": "В классе", "klass_gen": "класса",
    "all_klass": "всем классом", "class_chat": "чат класса", "class_chat_gen": "чата класса", "in_chat": "в чате класса",
    "parallel": "из параллельного класса", "mentor_role": "классная руководительница",
    "mentor_role_dat": "классной руководительнице", "mentor_role_cap": "Классная руководительница",
}
SAMPLE_SPO = dict(SAMPLE, grade="2 курс", school="колледж", school_cap="Колледж", in_school="в колледже",
                  in_school_cap="В колледже", school_gen="колледжа", to_school="в колледж", mates="одногруппники",
                  mates_dat="одногруппникам", mates_gen="одногруппников", in_class="в группе", in_class_cap="В группе",
                  klass_gen="группы", all_klass="всей группой", class_chat="чат группы", class_chat_gen="чата группы",
                  in_chat="в чате группы", parallel="из соседней группы", mentor_role="куратор группы",
                  mentor_role_dat="куратору группы", mentor_role_cap="Куратор группы", age="17")


def load_js_array(path):
    s = path.read_text(encoding="utf-8")
    return json.loads(s[s.index("concat(") + 7: s.rindex(")")])


def render(text, sample):
    def gender(m):
        pre, a, b = m.group(1), m.group(2), m.group(3)
        if a == "":
            return f"{pre}({b})"          # сделал{|а} → сделал(а)
        return f"{pre}{a}/{b}" if pre else f"{a}/{b}"  # пош{ёл|ла} → пошёл/ла, {друг|подруга} → друг/подруга
    t = re.sub(r"([А-Яа-яЁё]*)\{([^{}|]*)\|([^{}|]*)\}", gender, text)
    return re.sub(r"\{(\w+)\}", lambda m: sample.get(m.group(1), m.group(0)), t)


def fx_text(fx):
    parts = [f"{'+' if v > 0 else '−'}{abs(v)} {STAT_NAMES[k]}" for k, v in fx.items()]
    return ", ".join(parts)


def shade(cell, hex_color):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_color)
    tc_pr.append(shd)


def para(doc, text="", bold=False, italic=False, color=None, size=None, style=None, space_after=4):
    p = doc.add_paragraph(style=style)
    if text:
        r = p.add_run(text)
        r.bold, r.italic = bold, italic
        if color is not None:
            r.font.color.rgb = color
        if size:
            r.font.size = Pt(size)
    p.paragraph_format.space_after = Pt(space_after)
    return p


def labeled(doc, label, text, color=None, indent=0.0):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(3)
    if indent:
        p.paragraph_format.left_indent = Cm(indent)
    r = p.add_run(label + " ")
    r.bold = True
    if color is not None:
        r.font.color.rgb = color
    p.add_run(text)
    return p


def main():
    stories = []
    for name in ["past", "present", "future", "echo"]:
        stories += load_js_array(ROOT / "js" / f"stories-{name}.js")
    order = {"past": 0, "present": 1, "future": 2}
    stories.sort(key=lambda s: (order[s["era"]], "echo" in s))

    doc = Document()
    st = doc.styles["Normal"]
    st.font.name = "Calibri"
    st.font.size = Pt(11)
    st.element.rPr.rFonts.set(qn("w:eastAsia"), "Calibri")
    for s in doc.sections:
        s.left_margin = s.right_margin = Cm(2)
        s.top_margin = s.bottom_margin = Cm(1.8)

    # ---------- Титул и как устроено ----------
    h = doc.add_heading("1 из 22 миллионов", 0)
    para(doc, "Онлайн-игра для разминки перед рабочими листами «Мастерской безопасных решений». "
              "Все истории, варианты выбора и последствия.", color=DIM, size=12)
    para(doc, "Игра: https://irinilou.github.io/1in22m.life/", bold=True)

    doc.add_heading("Как устроена игра", 1)
    for line in [
        "Время: 5–7 минут с телефона. Регистрация не нужна.",
        "Старт. Участник выбирает время («Как повезёт», прошлое, настоящее или будущее), способ выбора региона "
        "(«Как в жизни» — по численности учащихся или «Любой из 89» с равным шансом) и пол героя (или случайно).",
        "Рождение. Случай выбирает один из 89 субъектов РФ, населённый пункт, год, имя, класс (5–11) или курс СПО (1–4) "
        "со специальностью. Игра показывает: «Ты — 1 из ≈ N школьников и студентов региона и 1 из ≈ 22 млн по стране».",
        "Уклон жизни. Участник выбирает, чем живёт герой: учёба, друзья, творчество, спорт или игры и техника. "
        "От уклона зависят стартовые шкалы, дополнительные строки в последствиях и профессия в финале.",
        "История. Завязка → первый выбор из трёх вариантов → последствие → поворот (вводная фраза зависит от первого выбора) "
        "→ второй выбор из трёх → последствие.",
        "Финал «через 8–14 лет»: что осталось от каждого решения, кем стал герой, итог жизни по самой сильной шкале, "
        "его путь, «Взгляд педагога» (вопрос для размышления) и приглашение сравнить историю с соседом.",
        "Шкалы (опоры): друзья рядом, доверие к взрослым, уверенность, цифровая грамотность. Каждое решение их меняет, "
        "участник видит изменения сразу.",
        "Верных и неверных ответов нет: у каждого варианта есть плюсы и цена. Тяжёлых сцен (суицид, насилие) нет.",
    ]:
        para(doc, line, style="List Bullet", space_after=2)

    doc.add_heading("Сколько повторов будет в зале", 1)
    para(doc, "Всего 30 историй: по 10 на каждое время. Внутри истории регион, год, имя, класс и уклон всё равно выпадают "
              "случайно, так что двух одинаковых жизней практически не бывает.")
    para(doc, "Если 350 человек оставят «Как повезёт», одна история в среднем попадётся 12 раз, а самая частая — около 19–23 раз. "
              "Если весь зал выберет одно и то же время, историй будет 10 на всех, и повторов станет 35–50. Поэтому ведущему лучше "
              "сказать: «Время оставьте „Как повезёт“ — или выберите любое, но не все одно и то же».")
    para(doc, "На одном телефоне истории не повторяются, пока не пройдены все 10 в выбранном времени. Кнопка «Прожить другую жизнь» сразу даёт новую.")
    para(doc, "6 историй отмечены как «разминка»: они перекликаются с популярными кейсами рабочих листов "
              "(нейросети, анонимность, съёмка и пересылка), но показывают их в другом времени и с другой стороны. "
              "Остальные 24 ситуации в рабочих листах не встречаются.")

    doc.add_heading("Как читать этот файл", 1)
    para(doc, "Род в текстах дан через скобки и косую черту: «сделал(а)», «пошёл/ла», «друг/подруга». В игре он подставляется "
              "по полу героя. Имена и слова подставлены для примера: героя зовут Саша, друга — Женя, классную руководительницу — "
              "Анна Сергеевна. В историях для колледжа «класс» меняется на «группу», а классная руководительница — на куратора.")
    para(doc, "У каждого варианта указано: что происходит, как меняются шкалы, «+ если уклон» (дополнительная строка, если у героя "
              "такой уклон), «мостик» к повороту и «через годы» — строка для финала.")

    # ---------- Сводная таблица ----------
    doc.add_heading("Все 30 историй", 1)
    t = doc.add_table(rows=1, cols=5)
    t.style = "Light Grid Accent 1"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, head in enumerate(["№", "Время", "История", "Роль героя", "Кто может выпасть"]):
        t.rows[0].cells[i].text = head
    for n, s in enumerate(stories, 1):
        ages = [a for a in s["ages"]]
        school = [str(a) for a in ages if isinstance(a, int)]
        spo = [a[1:] for a in ages if isinstance(a, str)]
        who = []
        if school:
            who.append(f"{school[0]}–{school[-1]} класс" if len(school) > 1 else f"{school[0]} класс")
        if spo:
            who.append(f"СПО {spo[0]}–{spo[-1]} курс" if len(spo) > 1 else f"СПО {spo[0]} курс")
        title = render(s["title"], SAMPLE) + (" (разминка)" if "echo" in s else "")
        row = t.add_row().cells
        for i, val in enumerate([str(n), ERA_NAMES[s["era"]].split(" (")[0], s["emoji"] + " " + title, s["role"], ", ".join(who)]):
            row[i].text = val
    for row in t.rows:
        for c in row.cells:
            for p in c.paragraphs:
                for r in p.runs:
                    r.font.size = Pt(9.5)

    # ---------- Истории ----------
    current_era = None
    for n, s in enumerate(stories, 1):
        sample = SAMPLE_SPO if all(isinstance(a, str) for a in s["ages"]) else SAMPLE
        if s["era"] != current_era:
            current_era = s["era"]
            doc.add_page_break()
            doc.add_heading(ERA_NAMES[current_era], 1)
        else:
            doc.add_paragraph()

        doc.add_heading(f"{n}. {s['emoji']} {render(s['title'], sample)}", 2)
        meta = f"Роль героя: {s['role']}. Годы: {s['years'][0]}–{s['years'][1]}."
        para(doc, meta, color=DIM, size=10)
        if "echo" in s:
            para(doc, f"Разминка: перекликается с кейсом рабочих листов — {s['echo'].replace('Кейс', 'кейс')}.",
                 italic=True, color=ACCENT, size=10)

        para(doc, "Завязка", bold=True, color=ACCENT, space_after=2)
        for p in s["intro"]:
            para(doc, render(p, sample))

        para(doc, "Выбор 1. " + render(s["q1"], sample), bold=True, color=ACCENT, space_after=2)
        for i, o in enumerate(s["a"]):
            labeled(doc, "АБВ"[i] + ".", render(o["t"], sample)).runs[1].bold = True
            labeled(doc, "Что происходит:", render(o["r"], sample), indent=0.6)
            for tilt, line in (o.get("tl") or {}).items():
                labeled(doc, f"+ если уклон {TILT_NAMES[tilt]}:", render(line, sample), color=DIM, indent=0.6)
            labeled(doc, "Шкалы:", fx_text(o["fx"]), color=DIM, indent=0.6)
            labeled(doc, "Мостик к повороту:", render(o["br"], sample), color=DIM, indent=0.6)
            labeled(doc, "Через годы:", render(o["ep"], sample), color=DIM, indent=0.6)

        box = doc.add_table(rows=1, cols=1)
        cell = box.rows[0].cells[0]
        shade(cell, "E6ECFD")
        cell.paragraphs[0].add_run("Поворот. ").bold = True
        cell.paragraphs[0].add_run(render(s["twist"], sample))
        doc.add_paragraph().paragraph_format.space_after = Pt(0)

        para(doc, "Выбор 2. " + render(s["q2"], sample), bold=True, color=ACCENT, space_after=2)
        for i, o in enumerate(s["b"]):
            labeled(doc, "АБВ"[i] + ".", render(o["t"], sample)).runs[1].bold = True
            labeled(doc, "Что происходит:", render(o["r"], sample), indent=0.6)
            for tilt, line in (o.get("tl") or {}).items():
                labeled(doc, f"+ если уклон {TILT_NAMES[tilt]}:", render(line, sample), color=DIM, indent=0.6)
            labeled(doc, "Шкалы:", fx_text(o["fx"]), color=DIM, indent=0.6)
            labeled(doc, "Через годы:", render(o["ep"], sample), color=DIM, indent=0.6)

        labeled(doc, "Взгляд педагога (на финальном экране):", render(s["view"], sample), color=ACCENT)

    # ---------- Общие тексты ----------
    content = (ROOT / "js" / "content.js").read_text(encoding="utf-8")
    doc.add_page_break()
    doc.add_heading("Общие тексты игры", 1)

    doc.add_heading("Уклоны жизни и стартовые шкалы", 2)
    para(doc, "У всех шкал старт 40, уклон добавляет:")
    for line in ["📚 Учёба — +15 доверие к взрослым, +5 цифровая грамотность",
                 "🫶 Друзья — +20 друзья рядом",
                 "🎨 Творчество — +10 уверенность, +10 цифровая грамотность",
                 "⚽ Спорт — +15 уверенность, +5 друзья рядом",
                 "🎮 Игры и техника — +15 цифровая грамотность, +5 друзья рядом"]:
        para(doc, line, style="List Bullet", space_after=2)

    beats = re.search(r"window\.BEATS = (\{.*?\n\});", content, re.S).group(1)
    doc.add_heading("Жизнь до истории (по времени и уклону)", 2)
    for era in ["past", "present", "future"]:
        block = re.search(era + r": \{(.*?)\n  \}", beats, re.S).group(1)
        para(doc, ERA_NAMES[era], bold=True, space_after=2)
        for tilt, text in re.findall(r"(\w+):\s+\"(.*?)\",?\n", block + "\n"):
            labeled(doc, TILT_NAMES[tilt] + ":", render(text, SAMPLE), indent=0.4)

    doc.add_heading("Классная руководительница / куратор (по времени)", 2)
    for era, text in re.findall(r"(past|present|future): \{\n.*?mentor: \"(.*?)\"", content, re.S):
        labeled(doc, ERA_NAMES[era] + ":", render(text, SAMPLE))

    doc.add_heading("Кем стал герой (по уклону, одна строка случайно)", 2)
    careers = re.search(r"window\.CAREERS = \{(.*?)\n\};", content, re.S).group(1)
    for tilt, a, b in re.findall(r"(\w+):\s+\[\"(.*?)\",\s+\"(.*?)\"\]", careers, re.S):
        para(doc, TILT_NAMES[tilt], bold=True, space_after=1)
        para(doc, "• " + render(a, SAMPLE), space_after=1)
        para(doc, "• " + render(b, SAMPLE))

    doc.add_heading("Итог жизни (по самой высокой шкале)", 2)
    for line in ["Друзья рядом — «Человек, у которого есть свои»",
                 "Доверие к взрослым — «Человек, который умеет просить о помощи»",
                 "Уверенность — «Человек, который не прячется»",
                 "Цифровая грамотность — «Человек, который понимает, как устроена сеть»",
                 "Если все шкалы ниже 50 — «Человек, который справился почти в одиночку»"]:
        para(doc, line, style="List Bullet", space_after=2)

    doc.save(OUT)
    print("Готово:", OUT)


if __name__ == "__main__":
    main()
