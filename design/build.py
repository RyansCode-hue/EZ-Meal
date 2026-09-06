# Generates the Clean pantry screens. Run: python3 build.py
import pathlib, json

BG, SURF, INK, MUTED, GREEN, SOFT, RULE, RULE2 = '#F6F8F4', '#FFFFFF', '#1B231E', '#59665E', '#1F6B4A', '#DDEEE3', '#D5DDD7', '#B9C5BD'
WARN, WARNSOFT, DANGER, DANGERSOFT = '#8A5A0B', '#FBEFD9', '#B3261E', '#F9E3E1'
HEAD_FONT = "'Bricolage Grotesque', 'IBM Plex Sans', sans-serif"
BODY_FONT = "'IBM Plex Sans', system-ui, sans-serif"
HEAD = f'''  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
  <style> body {{ margin:0; font-family:{BODY_FONT}; color:{INK}; }} a {{ color:{GREEN}; }} a:hover {{ color:#174F37; }} </style>'''

def svg(path, size=24, sw=1.8, fill='none'):
  return f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="{fill}" stroke="currentColor" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round">{path}</svg>'
I = {
 'calendar': '<rect x="3" y="5" width="18" height="16" rx="3"></rect><path d="M3 10h18M8 3v4M16 3v4"></path>',
 'book': '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"></path><path d="M4 19a2 2 0 0 1 2-2h13"></path>',
 'cart': '<path d="M3 4h2l2.4 11h11l2-7H7"></path><circle cx="9" cy="19" r="1.5"></circle><circle cx="17" cy="19" r="1.5"></circle>',
 'tray': '<rect x="3" y="4" width="18" height="7" rx="2"></rect><rect x="3" y="13" width="18" height="7" rx="2"></rect>',
 'bulb': '<path d="M9 18h6M10 21h4M8 13a5 5 0 1 1 8 0c-1 1-1.5 2-1.5 3h-5c0-1-.5-2-1.5-3z"></path>',
 'dish': '<path d="M4 15h16M6 15a6 6 0 0 1 12 0M12 8V6"></path>',
 'out': '<path d="M4 10l1-5h14l1 5M5 10v10h14V10M9 20v-6h6v6"></path>',
 'skip': '<circle cx="12" cy="12" r="8"></circle><path d="M8 12h8"></path>',
 'check': '<circle cx="12" cy="12" r="8"></circle><path d="M8.5 12l2.5 2.5 4.5-5"></path>',
 'circle': '<circle cx="12" cy="12" r="8"></circle>',
 'plus': '<path d="M12 5v14M5 12h14"></path>', 'minus': '<path d="M5 12h14"></path>',
 'back': '<path d="M15 5l-7 7 7 7"></path>', 'fwd': '<path d="M9 5l7 7-7 7"></path>',
 'people': '<circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-5-6.3"></path>',
 'search': '<circle cx="11" cy="11" r="6.5"></circle><path d="M20 20l-4.2-4.2"></path>',
 'edit': '<path d="M4 20h4l10.5-10.5a2 2 0 0 0-4-4L4 16z"></path><path d="M13 7l4 4"></path>',
 'camera': '<path d="M4 8h3l2-3h6l2 3h3v11H4z"></path><circle cx="12" cy="13" r="3.5"></circle>',
 'clipboard': '<rect x="6" y="4" width="12" height="17" rx="2"></rect><path d="M9 4V2.5h6V4M9 10h6M9 14h6"></path>',
 'link': '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L11.5 6.8"></path><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5"></path>',
 'pen': '<path d="M4 20l4-1L19 8a2 2 0 0 0-3-3L5 16z"></path>',
 'star': '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.8l-5.3 2.9 1.1-5.9-4.3-4.1 5.9-.8z"></path>',
 'x': '<path d="M6 6l12 12M18 6L6 18"></path>',
 'dots': '<circle cx="5" cy="12" r="1.6" fill="currentColor"></circle><circle cx="12" cy="12" r="1.6" fill="currentColor"></circle><circle cx="19" cy="12" r="1.6" fill="currentColor"></circle>',
 'chat': '<path d="M4 5h16v11H9l-5 4z"></path>',
 'shuffle': '<path d="M3 7h4l10 10h4M3 17h4l3-3M14 7h7l-3-3M18 21l3-3"></path>',
 'sparkle': '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"></path>',
 'chevron': '<path d="M9 6l6 6-6 6"></path>',
}
def ic(n, size=24, sw=1.8): return svg(I[n], size, sw)

def label(t, color=MUTED): return f'<div style="font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:{color};">{t}</div>'
def h1(t): return f'<div style="font-family:{HEAD_FONT};font-size:28px;font-weight:700;letter-spacing:-0.02em;line-height:1.05;">{t}</div>'
def h2(t): return f'<div style="font-family:{HEAD_FONT};font-size:20px;font-weight:700;letter-spacing:-0.01em;line-height:1.15;">{t}</div>'
def small(t): return f'<div style="font-size:13px;color:{MUTED};line-height:1.4;">{t}</div>'
def body(t): return f'<div style="font-size:16px;line-height:1.4;">{t}</div>'
def card(inner, extra=''): return f'<div style="background:{SURF};border:1px solid {RULE};border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:10px;{extra}">{inner}</div>'
def button(t, kind='primary', extra=''):
  st = {'primary': f'background:{GREEN};color:#FFFFFF;border:1px solid {GREEN};', 'secondary': f'background:{SURF};color:{INK};border:1px solid {RULE2};', 'danger': f'background:{SURF};color:{DANGER};border:1px solid {DANGER};'}[kind]
  return f'<div style="min-height:48px;padding:0 20px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600;box-sizing:border-box;{st}{extra}">{t}</div>'
def chip(t, active=False, removable=False):
  st = f'background:{GREEN};color:#FFFFFF;border:1px solid {GREEN};' if active else f'background:{SURF};color:{INK};border:1px solid {RULE2};'
  x = f'<span style="opacity:.7;">×</span>' if removable else ''
  return f'<div style="padding:7px 12px;border-radius:999px;font-size:13px;font-weight:600;{st}white-space:nowrap;display:flex;align-items:center;gap:6px;">{t}{x}</div>'
def field(lbl, value='', placeholder='', hint='', multiline=False, extra=''):
  txt = f'<span style="color:{INK};">{value}</span>' if value else f'<span style="color:{MUTED};">{placeholder}</span>'
  box = f'min-height:72px;align-items:flex-start;padding:12px;' if multiline else 'min-height:48px;align-items:center;padding:0 12px;'
  return f'<div style="display:flex;flex-direction:column;gap:4px;{extra}">{label(lbl)}<div style="{box}box-sizing:border-box;border:1px solid {RULE2};border-radius:10px;background:{SURF};display:flex;font-size:16px;">{txt}</div>{small(hint) if hint else ""}</div>'
def iconbtn(n, color=INK, size=44, bg='', border=''): return f'<div style="width:{size}px;height:{size}px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:{color};box-sizing:border-box;{bg}{border}">{ic(n)}</div>'
def stepper(lbl, val): return f'<div style="display:flex;align-items:center;justify-content:space-between;"><div style="font-size:16px;font-weight:600;">{lbl}</div><div style="display:flex;align-items:center;gap:4px;">{iconbtn("minus", INK, 42, f"background:{SURF};", f"border:1px solid {RULE2};")}<div style="min-width:44px;text-align:center;font-size:18px;font-weight:700;">{val}</div>{iconbtn("plus", INK, 42, f"background:{SURF};", f"border:1px solid {RULE2};")}</div></div>'
def stars(n, size=18): return '<div style="display:flex;gap:2px;">' + ''.join(f'<div style="color:{WARN if i < n else RULE2};">{svg(I["star"], size, 1.8, "currentColor" if i < n else "none")}</div>' for i in range(5)) + '</div>'

def tabbar(active):
  items = [('calendar','Plan'),('book','Recipes'),('cart','Groceries'),('tray','Pantry'),('bulb','Ideas')]
  def cell(i, l):
    on = l == active
    return f'<div style="display:flex;flex-direction:column;align-items:center;gap:2px;width:66px;height:50px;justify-content:center;border-radius:10px;{f"background:{GREEN};color:#FFFFFF;" if on else f"color:{MUTED};"}">{ic(i)}<div style="font-size:11px;font-weight:{700 if on else 600};">{l}</div></div>'
  cells = ''.join(cell(i, l) for i,l in items)
  return f'<div style="position:absolute;left:0;right:0;bottom:0;height:84px;padding:12px 8px 18px;box-sizing:border-box;background:{SURF};border-top:1px solid {RULE};display:flex;justify-content:space-around;align-items:flex-start;">{cells}</div>'
def header(title, back=False, right='people'):
  left = f'<div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;color:{GREEN};">{ic("back")}</div>' if back else '<div style="width:44px;"></div>'
  r = f'<div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;color:{INK};">{ic(right)}</div>' if right else '<div style="width:44px;"></div>'
  return f'<div style="padding:52px 8px 0;display:flex;align-items:center;justify-content:space-between;background:{BG};"><div style="display:flex;align-items:center;gap:4px;">{left}<div style="font-family:{HEAD_FONT};font-size:20px;font-weight:700;letter-spacing:-0.01em;">{title}</div></div>{r}</div>'
def phone(content, active=None, title=None, back=False, right='people', overlay='', top_inset=True):
  hdr = header(title, back, right) if title else ('<div style="height:52px;"></div>' if top_inset else '')
  tb = tabbar(active) if active else ''
  pad_bottom = 90 if active else 24
  return f'''<div style="width:390px;height:844px;position:relative;overflow:hidden;background:{BG};color:{INK};display:flex;flex-direction:column;">
{hdr}
<div style="flex:1;overflow:hidden;padding:12px 16px {pad_bottom}px;display:flex;flex-direction:column;gap:12px;">
{content}
</div>
{tb}
{overlay}
</div>'''
def sheet(title, inner): return f'<div style="position:absolute;inset:0;background:rgba(27,35,30,0.45);display:flex;align-items:flex-end;"><div style="width:100%;background:{BG};border-top-left-radius:20px;border-top-right-radius:20px;padding:24px 24px 32px;box-sizing:border-box;display:flex;flex-direction:column;gap:12px;">{label(title)}{inner}</div></div>'
def sheetrow(icon, t, sub='', color=GREEN): return f'<div style="display:flex;align-items:center;gap:12px;padding:12px;background:{SURF};border:1px solid {RULE};border-radius:14px;min-height:48px;box-sizing:border-box;"><div style="width:28px;display:flex;justify-content:center;color:{color};">{ic(icon, 22)}</div><div style="flex:1;display:flex;flex-direction:column;"><div style="font-size:16px;font-weight:600;">{t}</div>{small(sub) if sub else ""}</div></div>'
def page(body_html, width, height):
  return f'''<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
{HEAD}
</helmet>
<div style="width:{width}px;height:{height}px;display:flex;flex-direction:column;">
{body_html}
</div>
</x-dc>
</body>
</html>
'''

files = {}
DAYS = [('Sun','6',[('dish','Sheet-pan chicken','4 servings',True)]),('Mon','7',[('dish','Tacos','4 servings',False)]),('Tue','8',[('out','Eating out',None,False)]),('Wed','9',[('dish','Lentil soup','6 servings',False)]),('Thu','10',[]),('Fri','11',[('skip','Skip',None,False)]),('Sat','12',[('dish','Pancakes','2 servings',False),('dish','Grilled salmon','2 servings',False)])]
def day_card(d, n, entries, today):
  rows = ''
  for icon, name, sub, cooked in entries:
    color = GREEN if cooked else (INK if icon=='dish' else MUTED)
    deco = f'text-decoration:line-through;color:{MUTED};' if cooked else ''
    rows += f'<div style="display:flex;align-items:center;gap:10px;min-height:44px;"><div style="color:{color};display:flex;">{ic("check" if cooked else icon, 22)}</div><div style="flex:1;display:flex;flex-direction:column;"><div style="font-size:16px;font-weight:600;{deco}">{name}</div>{small(sub) if sub else ""}</div><div style="color:{MUTED};display:flex;">{ic("dots", 20)}</div></div>'
  if not rows: rows = f'<div style="min-height:44px;display:flex;align-items:center;">{small("Nothing planned")}</div>'
  border = f'border:2px solid {GREEN};' if today else f'border:1px solid {RULE};'
  return f'<div style="background:{SURF};border-radius:14px;padding:10px 12px;{border}display:flex;gap:12px;"><div style="width:44px;display:flex;flex-direction:column;align-items:center;padding-top:6px;"><div style="font-family:{HEAD_FONT};font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:{GREEN if today else MUTED};">{d}</div><div style="font-family:{HEAD_FONT};font-size:24px;font-weight:700;line-height:1.1;">{n}</div></div><div style="flex:1;display:flex;flex-direction:column;">{rows}</div><div style="width:36px;height:36px;border-radius:18px;background:{SOFT};color:{GREEN};display:flex;align-items:center;justify-content:center;align-self:flex-start;">{ic("plus", 20)}</div></div>'
weeknav = f'<div style="display:flex;align-items:center;gap:8px;">{iconbtn("back", INK, 44, f"background:{SURF};", f"border:1px solid {RULE};")}<div style="flex:1;display:flex;flex-direction:column;align-items:center;"><div style="font-family:{HEAD_FONT};font-size:26px;font-weight:700;letter-spacing:-0.01em;line-height:1;">Sep 6 – 12</div>{small("This week")}</div>{iconbtn("fwd", INK, 44, f"background:{SURF};", f"border:1px solid {RULE};")}</div>'
plan_content = weeknav + '<div style="display:flex;flex-direction:column;gap:8px;">' + ''.join(day_card(d,n,e,d=='Tue') for d,n,e in DAYS) + '</div>'
files['Main.dc.html'] = page(phone(plan_content, 'Plan', 'Plan'), 390, 844)

def recipe_row(title, meta, tags, rating, has_photo):
  thumb = f'<div style="width:64px;height:64px;border-radius:10px;background:{"#C9D8CE" if has_photo else BG};display:flex;align-items:center;justify-content:center;color:{RULE2};">{"" if has_photo else ic("dish", 24)}</div>'
  return f'<div style="display:flex;align-items:center;gap:12px;padding:12px;background:{SURF};border:1px solid {RULE};border-radius:14px;">{thumb}<div style="flex:1;display:flex;flex-direction:column;gap:2px;"><div style="font-size:17px;font-weight:600;">{title}</div>{small(meta)}<div style="display:flex;align-items:center;gap:8px;">{stars(rating, 14) if rating else ""}{small(tags)}</div></div><div style="color:{RULE2};">{ic("chevron", 18)}</div></div>'
def searchbox(t): return f'<div style="display:flex;align-items:center;gap:8px;padding:0 12px;min-height:48px;background:{SURF};border:1px solid {RULE};border-radius:10px;color:{MUTED};">{ic("search", 18)}<div style="font-size:16px;">{t}</div></div>'
chips = '<div style="display:flex;gap:8px;overflow:hidden;">' + chip('Under 30 min') + chip('weeknight', True) + chip('vegetarian') + chip('soup') + chip('holiday') + '</div>'
rows = '<div style="display:flex;flex-direction:column;gap:8px;">' + recipe_row('Sheet-pan chicken', '45 min · American', 'weeknight · sheet-pan', 4, True) + recipe_row('Tacos', '25 min · Mexican', 'quick · weeknight', 5, True) + recipe_row('Lentil soup', '55 min', 'vegetarian · soup', 0, False) + recipe_row('Twice baked mashed potatoes', '1 hr 25 min · American', 'side dish · holiday', 4, True) + recipe_row('Grilled salmon', '20 min', 'quick', 0, False) + '</div>'
fab = f'<div style="position:absolute;right:24px;bottom:98px;width:60px;height:60px;border-radius:30px;background:{GREEN};color:#FFFFFF;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.18);">{ic("plus", 30)}</div>'
files['Recipes.dc.html'] = page(phone(searchbox('Search recipes') + chips + rows, 'Recipes', 'Recipes', overlay=fab), 390, 844)
add_sheet = sheet('Add a recipe', sheetrow('pen', 'Type it in', 'Ingredients and steps by hand') + sheetrow('clipboard', 'Paste text', 'From a message, note, or website') + sheetrow('camera', 'Photo or file', 'A photo, screenshot, PDF, Word, or text file') + sheetrow('link', 'Website link', 'Paste a URL and it is read for you') + small('Tap outside to close'))
files['AddRecipe.dc.html'] = page(phone(searchbox('Search recipes') + chips + rows, 'Recipes', 'Recipes', overlay=add_sheet), 390, 844)

hero = f'<div style="height:200px;border-radius:14px;background:linear-gradient(160deg,#C9D8CE,#9DB8A6);flex-shrink:0;"></div>'
def ing(a, n, p=''): return f'<div style="display:flex;gap:12px;padding:6px 0;border-bottom:1px solid {RULE};"><div style="width:84px;font-size:16px;font-weight:600;color:{GREEN};">{a}</div><div style="flex:1;font-size:16px;line-height:1.4;">{n}{f"<span style=\"color:{MUTED};font-size:13px;\">, {p}</span>" if p else ""}</div></div>'
def step(i, t): return f'<div style="display:flex;gap:12px;padding:6px 0;"><div style="width:28px;font-size:18px;font-weight:700;color:{GREEN};">{i}</div><div style="flex:1;font-size:16px;line-height:1.4;">{t}</div></div>'
detail = hero + f'<div style="display:flex;flex-direction:column;gap:8px;">{h1("Sheet-pan chicken")}{small("American · 10 min prep · 35 min cook")}{body("Crisp thighs and potatoes on one pan. Weeknight dinner with one thing to wash.")}<div style="display:flex;flex-wrap:wrap;gap:6px;">{chip("weeknight", removable=True)}{chip("sheet-pan", removable=True)}{chip("+ tag")}</div></div>' + card(stepper('Servings', '4') + button('Add to plan', 'secondary')) + f'<div style="display:flex;flex-direction:column;">{h2("Ingredients")}{ing("2 lb","chicken thighs","bone-in")}{ing("1 lb","baby potatoes","halved")}{ing("2 tbsp","olive oil")}{ing("1 tsp","smoked paprika")}</div>' + f'<div style="display:flex;flex-direction:column;">{h2("Steps")}{step(1,"Heat the oven to 425°F.")}{step(2,"Toss potatoes with oil and paprika, spread on the pan.")}</div>' + card(label('Your rating') + stars(4, 30) + f'<div style="min-height:72px;padding:12px;border:1px solid {RULE2};border-radius:10px;font-size:16px;box-sizing:border-box;">More paprika next time.</div>' + f'<div style="padding-top:10px;border-top:1px solid {RULE};display:flex;flex-direction:column;gap:4px;">{label("Sarah")}{stars(5)}{body("Kids asked for seconds.")}</div>')
files['Recipe.dc.html'] = page(phone(detail, 'Recipes', 'Sheet-pan chicken', back=True, right='edit'), 390, 844)

def box(t, w='flex:1;', muted=False): return f'<div style="{w}min-height:48px;box-sizing:border-box;border:1px solid {RULE2};border-radius:10px;background:{SURF};display:flex;align-items:center;padding:0 10px;font-size:16px;color:{MUTED if muted else INK};">{t}</div>'
def ingrow(q,u,n,p): return f'<div style="display:flex;flex-direction:column;gap:4px;"><div style="display:flex;gap:4px;align-items:center;">{box(q,"width:72px;")}{box(u,"width:76px;")}{box(n)}<div style="width:40px;display:flex;justify-content:center;color:{MUTED};">{ic("x", 20)}</div></div>{box(p or "prep, e.g. diced (optional)", "", not p)}</div>'
edit = f'<div style="height:160px;border-radius:14px;background:linear-gradient(160deg,#C9D8CE,#9DB8A6);flex-shrink:0;"></div>' + f'<div style="display:flex;gap:8px;">{button("Change photo","secondary","flex:1;")}{button("Remove","secondary","flex:1;")}</div>' + field('Title', 'Sheet-pan chicken') + f'<div style="display:flex;gap:8px;">{field("Prep min","10",extra="flex:1;")}{field("Cook min","35",extra="flex:1;")}{field("Servings","4",extra="flex:1;")}</div>' + field('Tags', 'weeknight, sheet-pan', hint='Separate with commas') + h2('Ingredients') + ingrow('2','lb','chicken thighs','bone-in') + ingrow('1','lb','baby potatoes','halved') + button('Add ingredient','secondary') + h2('Steps') + f'<div style="display:flex;gap:4px;"><div style="width:24px;padding-top:12px;font-size:16px;font-weight:700;color:{GREEN};">1</div><div style="flex:1;min-height:64px;border:1px solid {RULE2};border-radius:10px;background:{SURF};padding:10px;font-size:16px;box-sizing:border-box;">Heat the oven to 425°F.</div></div>' + button('Save changes')
files['RecipeEdit.dc.html'] = page(phone(edit, 'Recipes', 'Edit recipe', back=True, right=None), 390, 844)

def gro(name, amt, checked=False, note='', partner=False):
  deco = f'text-decoration:line-through;color:{MUTED};' if checked else ''
  sub = ' · '.join([x for x in [note, 'Checked by Sarah' if partner else ''] if x])
  amt_html = f' <span style="font-weight:500;color:{MUTED};">{amt}</span>' if amt else ''
  return f'<div style="display:flex;align-items:center;background:{SURF};border:1px solid {RULE};border-radius:10px;"><div style="flex:1;display:flex;align-items:center;gap:12px;padding:12px;min-height:52px;box-sizing:border-box;"><div style="color:{GREEN if checked else RULE2};">{ic("check" if checked else "circle", 26)}</div><div style="flex:1;display:flex;flex-direction:column;"><div style="font-size:16px;font-weight:600;{deco}">{name}{amt_html}</div>{small(sub) if sub else ""}</div></div><div style="width:40px;display:flex;justify-content:center;color:{MUTED};">{ic("x", 18)}</div></div>'
def section(t, items): return f'<div style="display:flex;flex-direction:column;gap:4px;"><div style="margin-top:8px;">{label(t)}</div>{"".join(items)}</div>'
groceries = f'<div style="display:flex;flex-direction:column;gap:2px;">{h2("For Sep 6 – 12")}{small("6 to buy · 2 in the cart")}</div>' + f'<div style="display:flex;gap:8px;">{button("Generate","secondary","flex:1;")}{button("Add item","secondary","flex:1;")}</div>' + section('Produce', [gro('Baby potatoes','2 lb'), gro('Onion','2'), gro('Cilantro','1 bunch', True, partner=True)]) + section('Meat & seafood', [gro('Chicken thigh','4 lb'), gro('Ground beef','2 lb', True)]) + section('Pantry', [gro('Olive oil','5 tbsp', note='You have some'), gro('Red lentil','1 cup'), gro('Paper towels','', note='Added by hand')]) + button('Clear 2 bought items','secondary','margin-top:8px;')
files['Groceries.dc.html'] = page(phone(groceries, 'Groceries', 'Groceries'), 390, 844)

def seg(state):
  opts = [('Plenty', GREEN), ('Low', WARN), ('Out', MUTED)]
  cells = ''.join(f'<div style="flex:1;min-height:42px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;border-radius:8px;{f"background:{c};color:#FFFFFF;" if o.lower()==state else f"color:{MUTED};"}">{o}</div>' for o,c in opts)
  return f'<div style="display:flex;padding:3px;background:{BG};border:1px solid {RULE};border-radius:10px;width:196px;box-sizing:border-box;">{cells}</div>'
def pantry_row(name, qty, state): return f'<div style="display:flex;align-items:center;gap:12px;padding:8px 12px;background:{SURF};border:1px solid {RULE};border-radius:10px;"><div style="flex:1;display:flex;flex-direction:column;"><div style="font-size:16px;font-weight:600;">{name}</div>{small(qty) if qty else ""}</div>{seg(state)}</div>'
pantry = searchbox('Search the pantry') + f'<div style="display:flex;gap:8px;">{button("Add item","secondary","flex:1;")}{button("From a receipt photo","secondary","flex:1;")}</div>' + f'<div style="display:flex;flex-direction:column;gap:6px;">{section("Pantry", [pantry_row("Olive oil","about ½ bottle","low"), pantry_row("Rice","5 lb bag","plenty"), pantry_row("All-purpose flour","","plenty")])}{section("Spices", [pantry_row("Smoked paprika","","low"), pantry_row("Cumin","","out")])}{section("Produce", [pantry_row("Onion","3","plenty"), pantry_row("Garlic","1 head","low")])}</div>'
files['Pantry.dc.html'] = page(phone(pantry, 'Pantry', 'Pantry'), 390, 844)

def cooked_row(name, state): return f'<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid {RULE};"><div style="font-size:16px;font-weight:600;">{name}</div>{seg(state)}</div>'
cooked_sheet = sheet('Mark cooked', h2('Sheet-pan chicken') + small('Update the pantry so the next grocery list is right.') + f'<div style="display:flex;flex-direction:column;">{cooked_row("Chicken thigh","out")}{cooked_row("Baby potatoes","out")}{cooked_row("Olive oil","low")}{cooked_row("Smoked paprika","plenty")}</div>' + button('Done'))
files['CookedSheet.dc.html'] = page(phone(plan_content, 'Plan', 'Plan', overlay=cooked_sheet), 390, 844)

def idea_card(icon, t, sub, inner=''): return card(f'<div style="display:flex;align-items:center;gap:12px;"><div style="width:40px;height:40px;border-radius:10px;background:{SOFT};color:{GREEN};display:flex;align-items:center;justify-content:center;">{ic(icon, 22)}</div><div style="flex:1;display:flex;flex-direction:column;"><div style="font-size:17px;font-weight:600;">{t}</div>{small(sub)}</div></div>' + inner)
def match(t, have, tot): return f'<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-top:1px solid {RULE};"><div style="flex:1;display:flex;flex-direction:column;"><div style="font-size:16px;font-weight:600;">{t}</div>{small(f"You have {have} of {tot} ingredients")}</div><div style="width:44px;height:8px;border-radius:4px;background:{RULE};overflow:hidden;"><div style="width:{int(100*have/tot)}%;height:100%;background:{GREEN};"></div></div></div>'
ideas = idea_card('tray', 'From the pantry', 'What you can make with what is on hand', match('Tacos', 7, 7) + match('Fried rice', 5, 6) + match('Lentil soup', 3, 5)) + idea_card('chat', 'Ask', 'Describe what you feel like and get a few ideas', f'<div style="display:flex;gap:8px;">{box("Something light with chicken, under 30 min", "flex:1;", True)}{iconbtn("sparkle","#FFFFFF",48,f"background:{GREEN};")}</div>') + idea_card('shuffle', 'Surprise me', 'A recipe you have not made in a while', button('Pick one', 'secondary'))
files['Ideas.dc.html'] = page(phone(ideas, 'Ideas', 'Ideas'), 390, 844)

def member(n, me=False): return f'<div style="font-size:16px;line-height:1.5;">{n}{f" <span style=\"color:{MUTED};\">(you)</span>" if me else ""}</div>'
def toggle(on): return f'<div style="width:46px;height:28px;border-radius:14px;background:{GREEN if on else RULE2};position:relative;flex-shrink:0;"><div style="position:absolute;top:3px;{"right:3px;" if on else "left:3px;"}width:22px;height:22px;border-radius:11px;background:#FFFFFF;"></div></div>'
def setrow(t, sub, on): return f'<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:6px 0;"><div style="display:flex;flex-direction:column;"><div style="font-size:16px;font-weight:600;">{t}</div>{small(sub)}</div>{toggle(on)}</div>'
settings = h1('The Ellerbroeks') + card(label('Invite code') + f'<div style="font-family:{HEAD_FONT};font-size:32px;font-weight:700;letter-spacing:4px;color:{GREEN};">19AB1774</div>' + small('Share this so your partner can join.') + button('Rotate code','secondary')) + card(label('Members') + member('Ryan', True) + member('Sarah')) + card(label('Reminders') + setrow('Plan the week', 'Saturday at 10:00', True) + setrow("Tonight's dinner", 'Every day at 3:00 pm', True) + setrow('Partner activity', 'When Sarah adds or changes a meal', False)) + f'<div style="display:flex;gap:8px;">{button("Change password","secondary","flex:1;")}{button("Sign out","danger","flex:1;")}</div>'
files['Settings.dc.html'] = page(phone(settings, None, 'Household', back=True, right=None), 390, 844)

signin = f'<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:16px;"><div style="display:flex;flex-direction:column;gap:4px;margin-bottom:8px;"><div style="font-family:{HEAD_FONT};font-size:44px;font-weight:700;letter-spacing:-0.03em;color:{GREEN};line-height:1;">EZ Meal</div>{small("Sign in to your household.")}</div>{field("Email","ryan@example.com")}{field("Password","••••••••••")}{button("Sign in")}<div style="text-align:center;font-size:15px;font-weight:500;color:{GREEN};">New here? Create an account</div></div>'
files['SignIn.dc.html'] = page(phone(signin, None, None, top_inset=False), 390, 844)

rail_items = [('calendar','Plan',True),('book','Recipes',False),('cart','Groceries',False),('tray','Pantry',False),('bulb','Ideas',False)]
def rail_item(i, l, a): return f'<div style="width:66px;height:50px;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;{f"background:{GREEN};color:#FFFFFF;" if a else f"color:{MUTED};"}">{ic(i, 22)}<div style="font-size:11px;font-weight:{700 if a else 600};">{l}</div></div>'
rail = f'<div style="width:104px;background:{SURF};border-right:1px solid {RULE};padding:12px 0;display:flex;flex-direction:column;align-items:center;gap:6px;box-sizing:border-box;">' + ''.join(rail_item(i,l,a) for i,l,a in rail_items) + '<div style="flex:1;"></div>' + rail_item('people', 'Household', False) + '</div>'
desktop = f'<div style="width:1440px;height:900px;display:flex;background:{BG};color:{INK};overflow:hidden;">{rail}<div style="flex:1;display:flex;flex-direction:column;"><div style="height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 24px;"><div style="font-family:{HEAD_FONT};font-size:20px;font-weight:700;">Plan</div></div><div style="flex:1;overflow:hidden;display:flex;justify-content:center;"><div style="width:600px;display:flex;flex-direction:column;gap:12px;padding:0 16px;">{plan_content}</div></div></div></div>'
files['Desktop.dc.html'] = page(desktop, 1440, 900)

def sw(c, n, v): return f'<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-start;"><div style="width:72px;height:56px;border-radius:12px;background:{c};border:1px solid rgba(0,0,0,0.08);"></div><div style="font-size:13px;font-weight:600;">{n}</div><div style="font-size:12px;color:{MUTED};font-family:ui-monospace,monospace;">{v}</div></div>'
styles = f'''<div style="width:900px;height:720px;box-sizing:border-box;padding:40px;background:{BG};color:{INK};display:flex;flex-direction:column;gap:28px;overflow:hidden;">
  <div style="display:flex;flex-direction:column;gap:6px;">{label("Direction B · Clean pantry")}{h1("Styles")}</div>
  <div style="display:flex;gap:20px;flex-wrap:wrap;">{sw(GREEN,"Green",GREEN)}{sw(SOFT,"Soft green",SOFT)}{sw(BG,"Ground",BG)}{sw(SURF,"Surface",SURF)}{sw(INK,"Ink",INK)}{sw(MUTED,"Muted",MUTED)}{sw(RULE,"Rule",RULE)}{sw(WARN,"Warn",WARN)}{sw(DANGER,"Danger",DANGER)}</div>
  <div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:28px;">
    <div style="display:flex;flex-direction:column;gap:10px;">{label("Type")}<div style="font-family:{HEAD_FONT};font-size:28px;font-weight:700;letter-spacing:-0.02em;line-height:1.05;">Bricolage Grotesque 28 / titles</div><div style="font-family:{HEAD_FONT};font-size:20px;font-weight:700;letter-spacing:-0.01em;">Bricolage Grotesque 20 / headings</div><div style="font-size:16px;line-height:1.4;">IBM Plex Sans 16 / body, 22 line height</div><div style="font-size:13px;color:{MUTED};">IBM Plex Sans 13 / small, muted</div>{label("IBM Plex Sans 12 / labels, uppercase, +6% tracking")}</div>
    <div style="display:flex;flex-direction:column;gap:10px;">{label("Controls · 48 px tall, 10 px radius")}<div style="display:flex;gap:8px;">{button("Primary","primary","flex:1;")}{button("Secondary","secondary","flex:1;")}{button("Danger","danger","flex:1;")}</div><div style="display:flex;gap:8px;">{chip("Chip")}{chip("Active", True)}{chip("Removable", removable=True)}</div>{field("Field","Value","","Hint text under the field")}{stepper("Stepper", "4")}{seg("low")}</div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:28px;">{card(label("Card · 14 px radius, 1 px rule, 16 px padding") + body("Cards separate objects. One outlined in green is today. Sheets slide up over a 45% ink scrim."))}<div style="display:flex;flex-direction:column;gap:8px;">{label("States")}{gro("Unchecked item","2 lb")}{gro("Checked item","1 bunch", True)}</div></div>
</div>'''
files['Styles.dc.html'] = page(styles, 900, 720)

for name, src in files.items(): pathlib.Path(name).write_text(src)

GAP, ROW = 80, 120
row1 = ['Main.dc.html','Recipes.dc.html','AddRecipe.dc.html','Recipe.dc.html','RecipeEdit.dc.html']
row2 = ['Groceries.dc.html','Pantry.dc.html','CookedSheet.dc.html','Ideas.dc.html','Settings.dc.html','SignIn.dc.html']
titles = {'Main.dc.html':'Plan','Recipes.dc.html':'Recipes','AddRecipe.dc.html':'Add a recipe (phase 4 options)','Recipe.dc.html':'Recipe','RecipeEdit.dc.html':'Edit recipe','Groceries.dc.html':'Groceries','Pantry.dc.html':'Pantry (phase 5)','CookedSheet.dc.html':'Mark cooked (phase 5)','Ideas.dc.html':'Ideas (phase 6)','Settings.dc.html':'Household (reminders: phase 7)','SignIn.dc.html':'Sign in','Desktop.dc.html':'Website, wide window','Styles.dc.html':'Styles'}
Y2, Y3 = 844+ROW, 2*(844+ROW)
boards = [{'file': f, 'x': i*(390+GAP), 'y': 0, 'w': 390, 'h': 844, 'title': titles[f], 'page': 'screens'} for i, f in enumerate(row1)]
boards += [{'file': f, 'x': i*(390+GAP), 'y': Y2, 'w': 390, 'h': 844, 'title': titles[f], 'page': 'screens'} for i, f in enumerate(row2)]
boards += [{'file': 'Desktop.dc.html', 'x': 0, 'y': Y3, 'w': 1440, 'h': 900, 'title': titles['Desktop.dc.html'], 'page': 'screens'},
           {'file': 'Styles.dc.html', 'x': 1440+GAP, 'y': Y3, 'w': 900, 'h': 720, 'title': titles['Styles.dc.html'], 'page': 'screens'},
           {'file': 'DirectionA.dc.html', 'x': 0, 'y': 0, 'w': 390, 'h': 974, 'title': 'A · Chalkboard (not chosen)', 'page': 'directions'},
           {'file': 'DirectionC.dc.html', 'x': 470, 'y': 0, 'w': 390, 'h': 974, 'title': 'C · Diner (not chosen)', 'page': 'directions'}]
canvas = {
  'pages': [{'id': 'screens', 'name': 'Screens'}, {'id': 'directions', 'name': 'Directions'}],
  'artboards': boards,
  'annotations': [
    {'id': 'row1', 'x': 0, 'y': -150, 'w': 520, 'text': 'Built today, restyled. Plan, Recipes, the add sheet (with the phase 4 photo and link options), a recipe page, and the edit form.', 'page': 'screens'},
    {'id': 'row2', 'x': 0, 'y': Y2-150, 'w': 520, 'text': 'Groceries is built. Pantry, Mark cooked, Ideas, and the reminders block in Household are planned screens drawn ahead of their phases.', 'page': 'screens'},
    {'id': 'row3', 'x': 0, 'y': Y3-150, 'w': 520, 'text': 'The website on a laptop: same screens with the navigation as a left rail. Styles collects the tokens and controls for porting into the app.', 'page': 'screens'},
    {'id': 'dirs', 'x': 0, 'y': -150, 'w': 420, 'text': 'The two directions not chosen, kept for reference.', 'page': 'directions'},
  ],
  'launch': {'view': 'canvas', 'page': 'screens'},
}
pathlib.Path('canvas.json').write_text(json.dumps(canvas, indent=2))
print('screens written:', len(files))
