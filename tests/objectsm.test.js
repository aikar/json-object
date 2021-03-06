/** @flow */
/*
 * Copyright (c) (2017)
 *
 *  Written by Aikar <aikar@aikar.co>
 *
 *  @license MIT
 *
 */
import {ObjectManager, ObjectBase, ObjectCreator} from "../src/index";
import type {DataParameter} from "../src";
import {DataModel} from "../src/base-classes";
import {DefaultObjectCreator} from "../src/creators";

class Test2 extends ObjectBase {
  baz: string;
}
class Test4 extends ObjectBase {
  hello: string;
  static ObjectCreator = new (class extends ObjectCreator {
    async createObject(objCls: Function, data: DataParameter): Promise<any> | any {
      const obj = await Promise.resolve(super.createObject(objCls, data));
      obj.hello += " with special";
      return obj;
    }

    serializeObject(objCls: Function, data: DataParameter, origValue: any): {[string]: any} {
      data = super.serializeObject(objCls, data);
      // $FlowFixMe
      data.hello = data.hello.replace(/ with special/, '');
      return data;
    }
  })();
}

class Test3 extends ObjectBase {
  qux: number;
  test4: Test4;
}

class Test1 extends ObjectBase {
  foo: Test2;
  bar: Test3;
}
class NotRegistered {}

const mappings = {
  "test1": Test1,
  "test2": Test2,
  "test3": Test3,
};
const deserializer = new ObjectManager({
  mappings,
  errorOnUnknownType: false,
  defaultNamespace: "objectsm-ns"
});
deserializer.addMapping("test4", Test4);

const testFoo = [
  {
    ":cls": "objectsm-ns:::test2",
    "baz": "Hello1",
    "qux": null,
  },
  {
    ":cls": "objectsm-ns:::test2",
    "baz": "Hello2"
  }];
const testData = {test: {
  ":cls": "objectsm-ns:::test1",
  "foo": testFoo,
  "bar": {
    ":cls": "objectsm-ns:::test3",
    "qux": 42,
    "date": {":cls": "__DATE", "date": "2017-01-01T00:10:00.000Z"},
    "test4": {
      ":cls": "objectsm-ns:::test4",
      "hello": "world!"
    }
  }, unknown: {":cls": "objectsm-ns:::dwfewfwefwef", bar: 1},
}};
const orig = JSON.parse(JSON.stringify(testData));
let deserialized;
beforeAll(async () => {
  deserialized = await deserializer.deserialize(testData);
});

describe("Base API", () => {
  test("hasMapping", () => {
    expect(deserializer.hasMapping("test2")).toBe(true);
    expect(deserializer.hasMapping("fake_value")).toBe(false);
    expect(deserializer.hasMapping(Test2)).toBe(true);
    expect(deserializer.hasMapping(NotRegistered)).toBe(false);
  });
});
describe("Deserializing", () => {
  test("Null Values", async () => {
    const foo =  {foo: ["bar", null], bar: null};
    expect(await deserializer.deserialize(foo)).toEqual(foo);
  });
  test('instanceof', function () {
    expect(deserialized.test).toBeInstanceOf(Test1);
    expect(deserialized.test.foo).toBeInstanceOf(Array);
    expect(deserialized.test.foo[0]).toBeInstanceOf(Test2);
    expect(deserialized.test.foo[1]).toBeInstanceOf(Test2);
    expect(deserialized.test.bar).toBeInstanceOf(Test3);
    expect(deserialized.test.bar.test4).toBeInstanceOf(Test4);
  });
  test('Constructors are correct', function () {
    expect(deserialized.test.constructor.name).toEqual("Test1");
    expect(deserialized.test.foo[0].constructor.name).toEqual("Test2");
    expect(deserialized.test.foo[1].constructor.name).toEqual("Test2");
    expect(deserialized.test.bar.constructor.name).toEqual("Test3");
    expect(deserialized.test.bar.test4.constructor.name).toEqual("Test4");
  });
  test('Values are correct', function () {
    expect(deserialized.test.foo[0].baz).toEqual("Hello1");
    expect(deserialized.test.foo[1].baz).toEqual("Hello2");
    expect(deserialized.test.bar.qux).toEqual(42);
    expect(deserialized.test.bar.test4.hello).toEqual("world! with special");
  });
  test("deserializing root array", async () => {
    const arr = await deserializer.deserialize(testFoo);
    expect(arr[0]).toBeInstanceOf(Test2);
    expect(arr[1]).toBeInstanceOf(Test2);
    expect(arr[0].baz).toEqual("Hello1");
    expect(arr[1].baz).toEqual("Hello2");
  });
  test("Deserialize doesn't mutate original data", () => {
    expect(testData).toEqual(orig);
  });
});

describe("Serializing", () => {
  test("Matches original", async () => {
    const serialized = await deserializer.serialize(deserialized);
    expect(serialized).toEqual(testData);
  });
  test("Uses configured type key", async () => {
    const serializer = new ObjectManager({
      mappings,
      typeKey: ":test"
    });
    const serialized = await serializer.serialize(deserialized);
    expect(Object.keys(serialized.test)).toContain(":test");
  });
  test("input with functions", async () => {
    const obj = {
      test: 1,
      foo() {

      },
      bar: () => {

      },
      baz: "42"
    };
    const result = await deserializer.serialize(obj);
    expect(result).toEqual({test: 1, baz: "42"});
  });
});

describe("Models", () => {
  class TestModel extends DataModel {
    foo = 1;
    bar = 4;
    baz = 10;
    constructor(props) {
      super();
      this.withProperties(props);
    }
  }


  deserializer.addMapping("TestModel", TestModel);


  test("Object created correctly", () => {
    const obj = new TestModel({foo: 2});
    expect(obj.foo).toEqual(2);
    expect(obj.bar).toEqual(4);
    expect(obj.baz).toEqual(10);
  });

  test("Uses newly provided default", async () => {
    const obj = await deserializer.deserialize({
      ":cls": "objectsm-ns:::TestModel",
      foo: 5,
    });
    expect(obj.foo).toEqual(5);
    expect(obj.bar).toEqual(4);
    expect(obj.baz).toEqual(10);
  });

  test("Does not use defaults", async () => {
    const obj = await deserializer.deserialize({
      ":cls": "objectsm-ns:::TestModel",
      foo: 6,
      bar: 3,
      baz: null
    });
    expect(obj.foo).toEqual(6);
    expect(obj.bar).toEqual(3);
    expect(obj.baz).toEqual(null);
  });


  class TestModel2 extends DataModel {
    foo = 1;
    bar = 4;
    baz = 10;
  }
  deserializer.addMapping("TestModel2", TestModel2);

  test("No Constructor - Object created correctly", () => {
    const obj = new TestModel2();
    expect(obj.foo).toEqual(1);
    expect(obj.bar).toEqual(4);
    expect(obj.baz).toEqual(10);
  });

  test("No Constructor - Uses newly provided default", async () => {
    const obj = await deserializer.deserialize({
      ":cls": "objectsm-ns:::TestModel2",
      foo: 5,
    });
    expect(obj.foo).toEqual(5);
    expect(obj.bar).toEqual(4);
    expect(obj.baz).toEqual(10);
  });

  test("No Constructor - Does not use defaults", async () => {
    const obj = await deserializer.deserialize({
      ":cls": "objectsm-ns:::TestModel2",
      foo: 6,
      bar: 3,
      baz: null,
    });
    expect(obj.foo).toEqual(6);
    expect(obj.bar).toEqual(3);
    expect(obj.baz).toEqual(null);
  });

});

describe("Inheriting Object Creators", () => {
  class TestModel3 extends DataModel {}
  class TestModel4 extends TestModel3 {}
  class TestModel5 extends TestModel4 {
    static ObjectCreator: any = new (class CustomObjectCreator extends ObjectCreator {

    })();
  }
  class TestModel6 extends ObjectBase {}
  deserializer.addMapping("TestModel3", TestModel3);
  deserializer.addMapping("TestModel4", TestModel4);
  deserializer.addMapping("TestModel5", TestModel5);
  deserializer.addMapping("TestModel6", TestModel6);

  test("Model Object Creator", () => {
    expect(deserializer.objCreators.get("objectsm-ns:::TestModel3")).toEqual(DataModel.ObjectCreator);
  });
  test("Model Object Creator depth 2", () => {
    expect(deserializer.objCreators.get("objectsm-ns:::TestModel4")).toEqual(DataModel.ObjectCreator);
  });
  test("Model Object Creator depth 3", () => {
    expect(deserializer.objCreators.get("objectsm-ns:::TestModel5")).toEqual(TestModel5.ObjectCreator);
  });
  test("Standard Object Creator", () => {
    expect(deserializer.objCreators.get("objectsm-ns:::TestModel6")).toEqual(DefaultObjectCreator);
  });
});
describe("Namespaces", () => {
  class TestNS1 {}
  class TestNS2 {}

  const ns = new ObjectManager({
    defaultNamespace: "NS1",
    mappings: {
      "Test": TestNS1
    }
  });
  ns.addMapping("Test", TestNS2,  "NS2");
  test("Registered Correctly", () => {
    expect(ns.hasMapping("Test", "NS1")).toBeTruthy();
    expect(ns.hasMapping("Test", "NS2")).toBeTruthy();
    expect(ns.hasMapping("Test", "NS3")).toBeFalsy();
    expect(ns.id2ObjMap.get("NS1:::Test")).toEqual(TestNS1);
    expect(ns.id2ObjMap.get("NS2:::Test")).toEqual(TestNS2);
  });
  test("Deserializes Correctly", async () => {
    const result = await ns.deserialize({
      default: {":cls": "Test"},
      ns1: {":cls": "NS1:::Test"},
      ns2: {":cls": "NS2:::Test"}
    });
    expect(result.default).toBeInstanceOf(TestNS1);
    expect(result.ns1).toBeInstanceOf(TestNS1);
    expect(result.ns2).toBeInstanceOf(TestNS2);
  });

  test("Serializes Correctly", async () => {
    const expected = {
      ns1: {":cls": "NS1:::Test"},
      ns2: {":cls": "NS2:::Test"}
    };
    const result = await ns.serialize({
      ns1: new TestNS1(),
      ns2: new TestNS2(),
    });
    expect(result).toEqual(expected);
  });
});
