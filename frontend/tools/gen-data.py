# Sinh public/data/*.json từ thư mục data/ của Web1. Chạy: python3 tools/gen-data.py public/data
import json, sys
import os
W1 = os.environ.get('WEB1_DATA', '../AI_Nutrition_Commerce/data/')
OUT = sys.argv[1]
L = lambda n: json.load(open(W1 + n + '.json'))
local = {'p-0053':'ca-basa','p-0042':'ba-roi','p-0026':'chuoi','p-0025':'dua-hau','p-0023':'cam-sanh','p-0021':'mang-cut','p-0020':'bi-do','p-0071':'trung-ga','p-0015':'khoai-tay','p-0013':'bap-my','p-0004':'rau-muong','p-0160':'dau-an','p-0132':'gao','p-0155':'mien','p-0107':'banh','p-0139':'xuc-xich','p-0200':'ca-phe'}
keep = ['id','slug','name','brand','category','categoryName','subcategory','subcategoryName','description','price','sale_price','unit','stock','rating','review_count','sold_count','image_url','origin','badges','nutrition','netWeightGram','unitWeightGram','sellUnit','tags']
prods = []
for p in L('products'):
    q = {k: p.get(k) for k in keep}
    q['gallery'] = (p.get('gallery') or [])[:4]
    if p['id'] in local: q['img'] = 'img/p/' + local[p['id']] + '.jpg'
    prods.append(q)
cats = [{k: c[k] for k in ['id','slug','name','description','productCount','sortOrder']} | {'subcategories': [{'id': s['id'], 'name': s['name']} for s in c['subcategories']]} for c in L('categories')]
stores = [
 ('Quận 1 - Nguyễn Huệ','123 Nguyễn Huệ, P. Bến Nghé','028 3822 1111'),('Quận 3 - Võ Văn Tần','456 Võ Văn Tần, P. Võ Thị Sáu','028 3932 2222'),
 ('Quận 4 - Khánh Hội','88 Khánh Hội, P. 6','028 3940 3333'),('Quận 5 - Trần Hưng Đạo','210 Trần Hưng Đạo, P. 11','028 3855 4444'),
 ('Quận 7 - Tân Hưng','63 Đường Số 1, P. Tân Hưng','038 369 0006'),('Quận 10 - Sư Vạn Hạnh','540 Sư Vạn Hạnh, P. 12','028 3868 5555'),
 ('Bình Thạnh - Xô Viết Nghệ Tĩnh','321 Xô Viết Nghệ Tĩnh, P. 21','028 3512 4444'),('Phú Nhuận - Phan Xích Long','75 Phan Xích Long, P. 2','028 3995 6666'),
 ('Gò Vấp - Quang Trung','602 Quang Trung, P. 11','028 3894 7777'),('Tân Bình - Cộng Hòa','234 Cộng Hòa, P. 12','028 3811 8888'),
 ('Thủ Đức - Võ Văn Ngân','789 Võ Văn Ngân, P. Linh Chiểu','028 3896 3333'),('Bình Tân - Tên Lửa','110 Tên Lửa, P. Bình Trị Đông B','028 3752 9999')]
stores = [{'id': 's-%02d' % (i+1), 'name': a, 'address': b, 'phone': c, 'hours': '7:00 – 22:00'} for i, (a, b, c) in enumerate(stores)]
data = {'products': prods, 'categories': cats, 'vouchers': L('vouchers'), 'recipes': L('recipes'), 'ingredients': L('ingredients'), 'ingredientProductMap': L('ingredient-product-map'), 'orders': L('orders'), 'stores': stores}
if OUT.endswith('.js'):
    open(OUT, 'w').write('/* Sinh tự động từ data/*.json của Web1 */\nwindow.FM_DB = ' + json.dumps(data, ensure_ascii=False) + ';\n')
else:
    import os
    os.makedirs(OUT, exist_ok=True)
    for k, v in data.items():
        json.dump(v, open(os.path.join(OUT, k + '.json'), 'w'), ensure_ascii=False, indent=1)
print('ok', {k: len(v) for k, v in data.items()})
