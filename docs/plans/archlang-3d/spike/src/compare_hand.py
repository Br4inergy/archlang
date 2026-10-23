import sys, numpy as np, trimesh, collections, re, json
def census(path):
    sc = trimesh.load(path, force='scene'); names = list(sc.graph.nodes_geometry)
    allv = []; kinds = collections.Counter()
    for n in names:
        T, g = sc.graph[n]; m = sc.geometry[g].copy(); m.apply_transform(T); allv.append(m.vertices)
        k = re.split(r'[:_.]', n)[0]; kinds[k] += 1
    v = np.vstack(allv)
    return names, kinds, v.min(0), v.max(0)
for p in sys.argv[1:]:
    names, kinds, lo, hi = census(p)
    print(p, len(names), dict(kinds)); print('  bbox min', np.round(lo,3), 'max', np.round(hi,3), 'size', np.round(hi-lo,3))
    if 'laneway_house' in p: print('  nodes:', names)
